import { Logger } from '@nestjs/common';
import { Game } from '../game';
import { Entity } from '../game-map';

const logger = new Logger('ResolveEntities');

export function resolveEntities(game: Game, entityIds: string[], playerId: string): Entity[] {
  const result: Entity[] = [];
  for (const id of entityIds) {
    const e = game.map.entities.get(id);
    if (!e) { logger.warn(`resolve: entity=${id} not found`); continue; }
    if (e.ownerId !== playerId) { logger.warn(`resolve: entity=${id} owner mismatch`); continue; }
    if (e.type !== 'soldier') { logger.warn(`resolve: entity=${id} type=${e.type}`); continue; }
    result.push(e);
  }
  result.sort((a, b) => a.id.localeCompare(b.id));
  logger.log(`resolve: player=${playerId} requested=${entityIds.length} resolved=${result.length}`);
  return result;
}