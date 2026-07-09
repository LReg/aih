import { randomUUID } from 'crypto';
import { Gamemode } from '../game/gamemode.config';

export type PendingMatchState = 'forming' | 'countdown' | 'cancelled' | 'launched';

export class PendingMatch {
  readonly id: string = randomUUID();
  state: PendingMatchState = 'forming';
  secondsRemaining: number;

  constructor(
    public readonly gamemode: Gamemode,
    public readonly players: string[],
    startSeconds: number,
  ) {
    this.secondsRemaining = startSeconds;
  }
}
