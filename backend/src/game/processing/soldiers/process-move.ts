import { Game } from '../../game';
import { Entity } from '../../game-map';
import { advancePath } from '../../algorithms/movement/advancePath';
import { clearPath } from '../../algorithms/movement/tryCachedStep';
import { PathCache } from '../../algorithms/movement/pathCache';

export function processMove(game: Game, entity: Entity, pathCache: PathCache): void {
  const s = entity.state as { status: 'moving'; targetX: number; targetY: number };
  if (entity.x === s.targetX && entity.y === s.targetY) {
    clearPath(entity);
  } else {
    advancePath(game, entity, s.targetX, s.targetY, pathCache);
  }
}
