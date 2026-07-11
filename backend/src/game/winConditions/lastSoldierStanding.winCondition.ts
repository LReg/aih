import type { Game } from '../game';

export function lastSoldierStandingWinCondition(game: Game): string[] {
  const alive = new Set<string>();
  for (const entity of game.map.soldiers.values()) {
    alive.add(entity.ownerId);
  }
  if (alive.size === 1) return [alive.values().next().value as string];
  return [];
}