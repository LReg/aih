import { Game } from '../game';
import { findPath } from '../game-map';

export function processMovement(game: Game): void {
  for (const entity of game.map.entities.values()) {
    if (entity.state.status !== 'moving') continue;

    const { targetX, targetY } = entity.state as { status: 'moving'; targetX: number; targetY: number };
    if (entity.x === targetX && entity.y === targetY) {
      entity.state = { status: 'idle' };
      continue;
    }

    const path = findPath(entity.x, entity.y, targetX, targetY,
      (x, y) => !game.map.isTileEmpty(x, y),
      game.map.width, game.map.height);

    if (!path || path.length < 2) {
      entity.state = { status: 'idle' };
      continue;
    }

    const next = path[1];
    if (!game.map.isTileEmpty(next.x, next.y)) {
      entity.state = { status: 'idle' };
      continue;
    }

    game.map.moveEntity(entity.id, next.x, next.y);
  }
}