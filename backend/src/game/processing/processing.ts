import { Game } from '../game';
import { processMovement } from './processMovement';
import { processAttack } from './processAttack';
import { processTimers } from './processTimers';

export function processGame(game: Game): void {
  processMovement(game);
  processAttack(game);
  processTimers(game);
}