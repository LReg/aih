import { Game } from '../game';
import { PathCache } from '../algorithms/movement/pathCache';
import { processMovement } from './processMovement';
import { processAttack } from './processAttack';
import { processTimers } from './processTimers';

export function processGame(game: Game): void {
  const pathCache = new PathCache();
  processMovement(game, pathCache);
  processAttack(game, pathCache);
  processTimers(game);
}
