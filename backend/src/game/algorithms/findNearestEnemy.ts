import { Game } from '../game';
import { Entity } from '../game-map';
import { manhattan } from './findPath';

export function findNearestEnemy(game: Game, entity: Entity, range: number): Entity | null {
  let nearest: Entity | null = null;
  let nearestDist = Infinity;

  for (const other of game.map.entities.values()) {
    if (other.ownerId === entity.ownerId) continue;
    if (other.type !== 'soldier' && other.type !== 'barracks') continue;
    const dist = manhattan(entity, other);
    if (dist > range) continue;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = other;
    }
  }

  return nearest;
}