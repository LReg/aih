import { Game } from '../../game';
import { Entity } from '../../game-map';
import { findPath } from '../findPath';
import { tryCachedStep } from './tryCachedStep';

export function advancePath(
  game: Game,
  entity: Entity,
  targetX: number,
  targetY: number,
): boolean {
  if (tryCachedStep(game, entity, targetX, targetY)) return true;

  const path = findPath(
    entity.x, entity.y, targetX, targetY,
    (x, y) => !game.map.isTileEmpty(x, y),
    game.map.width, game.map.height,
  );

  if (!path || path.length < 2) return false;

  entity.path = path;
  entity.pathIndex = 1;
  const next = path[1];
  if (game.map.isTileEmpty(next.x, next.y)) {
    game.map.moveEntity(entity.id, next.x, next.y);
    entity.pathIndex = 2;
    return true;
  }

  entity.path = undefined;
  return false;
}
