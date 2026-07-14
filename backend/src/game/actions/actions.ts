import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Game, QueuedAction } from '../game';
import { walkAction } from './walk.action';
import { attackAction } from './attack.action';
import { buildBarracksAction } from './build-barracks.action';
import { setIdleAction } from './set-idle.action';
import { setSpawnClassAction } from './set-spawn-class.action';
import { surrenderAction } from './surrender.action';

const logger = new Logger('Actions');

export function queueGameAction(
  game: Game,
  playerId: string,
  body: { type: string; payload: unknown },
): { accepted: boolean; actionId?: string } {
  if (game.state !== 'running') {
    logger.warn(`queue rejected: game=${game.id} state=${game.state} player=${playerId} type=${body.type}`);
    return { accepted: false };
  }

  const incoming = (body.payload as { entityIds?: string[] })?.entityIds;
  if (incoming && incoming.length > 0) {
    const incomingSet = new Set(incoming);
    for (const queued of game.actionQueue) {
      if (queued.playerId !== playerId) continue;
      const queuedIds = (queued.payload as { entityIds?: string[] })?.entityIds;
      if (!queuedIds) continue;
      for (const id of queuedIds) {
        if (incomingSet.has(id)) {
          logger.warn(`queue rejected: entity=${id} already has queued action game=${game.id} player=${playerId}`);
          return { accepted: false };
        }
      }
    }
  }

  const action: QueuedAction = {
    id: randomUUID(),
    playerId,
    type: body.type,
    payload: body.payload,
    timestamp: Date.now(),
  };
  game.actionQueue.push(action);
  logger.log(`queued: id=${action.id} game=${game.id} player=${playerId} type=${body.type}`);
  return { accepted: true, actionId: action.id };
}

export function processActions(game: Game, actions: QueuedAction[]): void {
  for (const action of actions) {
    logger.log(`processing: id=${action.id} type=${action.type} player=${action.playerId}`);
    switch (action.type) {
      case 'walk': walkAction(game, action); break;
      case 'attack': attackAction(game, action); break;
      case 'build_barracks': buildBarracksAction(game, action); break;
      case 'set_idle': setIdleAction(game, action); break;
      case 'set_spawn_class': setSpawnClassAction(game, action); break;
      case 'surrender': surrenderAction(game, action); break;
      default: logger.warn(`unknown action type: ${action.type}`);
    }
  }
}