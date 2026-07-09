import type { Game } from '../game';
import { GAMEMODE_CONFIGS } from '../gamemode.config';

export function timeLimitWinCondition(game: Game): string[] {
  const config = GAMEMODE_CONFIGS[game.gamemode];
  if (!config.maxDurationMs) return [];

  const elapsed = Date.now() - game.startedAt;
  if (elapsed < config.maxDurationMs) return [];

  const counts = new Map<string, number>();
  for (const entity of game.map.entities.values()) {
    if (entity.type === 'soldier') {
      counts.set(entity.ownerId, (counts.get(entity.ownerId) || 0) + 1);
    }
  }

  if (counts.size === 0) return game.players;

  let maxCount = 0;
  const winners: string[] = [];
  for (const [pid, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      winners.length = 0;
      winners.push(pid);
    } else if (count === maxCount) {
      winners.push(pid);
    }
  }
  return winners;
}