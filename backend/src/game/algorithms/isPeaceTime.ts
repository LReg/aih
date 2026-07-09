import { Game } from '../game';

export function isPeaceTime(game: Game): boolean {
  return Date.now() < game.peaceUntil;
}