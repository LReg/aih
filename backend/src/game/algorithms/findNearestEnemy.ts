import { Game } from '../game';
import { Entity } from '../game-map';
import { manhattan } from './findPath';

export function findNearestEnemy(game: Game, entity: Entity, range: number): Entity | null {
  let nearest: Entity | null = null;
  let nearestDist = Infinity;

  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > range) continue;

      const nx = entity.x + dx;
      const ny = entity.y + dy;
      if (!game.map.isInBounds(nx, ny)) continue;

      const other = game.map.getEntityAt(nx, ny);
      if (!other) continue;
      if (other.ownerId === entity.ownerId) continue;
      if (other.type !== 'soldier' && other.type !== 'barracks') continue;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = other;
      }
    }
  }

  return nearest;
}
