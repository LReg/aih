import { Game } from '../game';
import { advancePath } from '../algorithms/movement/advancePath';
import { clearPath } from '../algorithms/movement/tryCachedStep';
import { PathCache } from '../algorithms/movement/pathCache';

export function processMovement(game: Game, pathCache: PathCache): void {
  for (const entity of game.map.entities.values()) {
    if (entity.state.status !== 'moving') continue;

    const s = entity.state as { status: 'moving'; targetX: number; targetY: number };
    if (entity.x === s.targetX && entity.y === s.targetY) {
      clearPath(entity);
      continue;
    }

    advancePath(game, entity, s.targetX, s.targetY, pathCache);
  }
}
