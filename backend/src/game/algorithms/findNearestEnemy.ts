import { Game } from '../game';
import { Entity } from '../game-map';
import { manhattan } from './findPath';

export function findNearestEnemy(game: Game, entity: Entity, range: number): Entity | null {
  const { cellSize, grid, entities } = game.map;
  const cx = Math.floor(entity.x / cellSize);
  const cy = Math.floor(entity.y / cellSize);
  const radius = Math.ceil(range / cellSize);

  let nearest: Entity | null = null;
  let nearestDist = Infinity;

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const cell = grid.get(`${cx + dx},${cy + dy}`);
      if (!cell) continue;

      for (const id of cell) {
        const other = entities.get(id);
        if (!other) continue;
        if (other.ownerId === entity.ownerId) continue;
        if (other.type !== 'soldier' && other.type !== 'barracks') continue;

        const dist = manhattan(entity, other);
        if (dist <= range && dist < nearestDist) {
          nearestDist = dist;
          nearest = other;
        }
      }
    }
  }

  return nearest;
}
