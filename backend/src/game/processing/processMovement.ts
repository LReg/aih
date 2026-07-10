import { Game } from '../game';
import { Entity } from '../game-map';
import { findPath } from '../algorithms/findPath';

function clearPath(entity: Entity) {
  entity.state = { status: 'idle' };
  entity.path = undefined;
}

function tryCachedStep(game: Game, entity: Entity, targetX: number, targetY: number): boolean {
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
  if (entity.pathIndex >= entity.path.length) clearPath(entity);
  return true;
}

export function processMovement(game: Game): void {
  for (const entity of game.map.entities.values()) {
    if (entity.state.status !== 'moving') continue;

    const s = entity.state as { status: 'moving'; targetX: number; targetY: number };
    if (entity.x === s.targetX && entity.y === s.targetY) {
      entity.state = { status: 'idle' };
      entity.path = undefined;
      continue;
    }

    if (tryCachedStep(game, entity, s.targetX, s.targetY)) continue;

    const path = findPath(
      entity.x, entity.y, s.targetX, s.targetY,
      (x, y) => !game.map.isTileEmpty(x, y),
      game.map.width, game.map.height,
    );

    if (!path || path.length < 2) {
      clearPath(entity);
      continue;
    }

    entity.path = path;
    entity.pathIndex = 1;
    tryCachedStep(game, entity, s.targetX, s.targetY);
  }
}
