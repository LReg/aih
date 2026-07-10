import { Game } from '../../game';
import { Entity } from '../../game-map';

export function tryCachedStep(
  game: Game,
  entity: Entity,
  targetX: number,
  targetY: number,
): boolean {
  if (!entity.path || entity.pathIndex === undefined) return false;

  const idx = entity.pathIndex;
  const dest = entity.path[entity.path.length - 1];
  if (idx >= entity.path.length || dest.x !== targetX || dest.y !== targetY) return false;

  const prev = entity.path[idx - 1];
  if (entity.x !== prev.x || entity.y !== prev.y) return false;

  const next = entity.path[idx];
  if (!game.map.isTileEmpty(next.x, next.y)) return false;

  game.map.moveEntity(entity.id, next.x, next.y);
  entity.pathIndex = idx + 1;
  return true;
}

export function clearPath(entity: Entity) {
  entity.path = undefined;
}
