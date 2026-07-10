import { Logger } from '@nestjs/common';
import { Game, QueuedAction } from '../game';
import { Entity } from '../game-map';
import { resolveEntities } from '../algorithms/resolveEntities';
import { getSpreadPositions } from '../algorithms/getSpreadPositions';
import { isPeaceTime } from '../algorithms/isPeaceTime';

const logger = new Logger('AttackAction');

interface AttackPayload { entityIds: string[]; x: number; y: number }

export function attackAction(game: Game, action: QueuedAction): void {
  if (isPeaceTime(game)) {
    logger.warn(`attack rejected during peace time game=${game.id}`);
    return;
  }
  const payload = action.payload as AttackPayload;
  const entities = resolveEntities(game, payload.entityIds, action.playerId);
  if (entities.length === 0) {
    logger.warn(`attack: no resolvable entities`);
    return;
  }

  const targets = getSpreadPositions(
    payload.x, payload.y, entities.length,
    (x, y) => game.map.isTileEmpty(x, y),
    game.map.width, game.map.height,
  );

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (entity.state.status === 'building-barracks') { continue; }
    const t = targets[i] || { x: payload.x, y: payload.y };
    entity.state = { status: 'attacking', targetX: t.x, targetY: t.y };
    entity.lastCommand = 'attack';
    logger.log(`attack: entity=${entity.id} target=(${t.x},${t.y})`);
  }
}

export function resolveEntityCombat(game: Game, entity: Entity, target: Entity, barracksKillChance: number): boolean {
  if (target.type === 'soldier') {
    const attackerWins = Math.random() < 0.5;
    if (attackerWins) {
      game.map.removeEntity(target.id);
      logger.log(`combat: entity=${entity.id} killed target=${target.id}`);
    } else {
      game.map.removeEntity(entity.id);
      logger.log(`combat: entity=${entity.id} killed by target=${target.id}`);
    }
    return attackerWins;
  }

  if (Math.random() < barracksKillChance) {
    game.map.removeEntity(target.id);
    logger.log(`combat: entity=${entity.id} destroyed barracks=${target.id}`);
    return true;
  }
  logger.log(`combat: entity=${entity.id} failed to destroy barracks=${target.id}`);
  return true;
}