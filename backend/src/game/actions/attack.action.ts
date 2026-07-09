import { Logger } from '@nestjs/common';
import { Game, QueuedAction } from '../game';
import { Entity } from '../game-map';
import { resolveEntities } from '../algorithms/resolveEntities';
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

  for (const entity of entities) {
    if (entity.state.status === 'building-barracks') { continue; }
    entity.state = { status: 'attacking', targetX: payload.x, targetY: payload.y };
    entity.lastCommand = 'attack';
    logger.log(`attack: entity=${entity.id} target=(${payload.x},${payload.y})`);
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