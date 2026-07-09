import { randomUUID } from 'crypto';
import { GameMap } from './game-map';
import { Gamemode } from './gamemode.config';

export type GameState = 'waiting' | 'countdown' | 'running' | 'finished';

export interface QueuedAction {
  id: string;
  playerId: string;
  type: string;
  payload: unknown;
  timestamp: number;
}

export class Game {
  readonly id: string = randomUUID();
  state: GameState = 'waiting';
  tick: number = 0;
  startedAt: number = 0;
  tickRateMs: number = 500;
  actionQueue: QueuedAction[] = [];
  winners: string[] = [];

  constructor(
    public readonly gamemode: Gamemode,
    public readonly map: GameMap,
    public readonly players: string[],
    public readonly createdAt: Date = new Date(),
  ) {}

  toJSON() {
    return {
      id: this.id,
      gamemode: this.gamemode,
      tick: this.tick,
      startedAt: this.startedAt,
      tickRateMs: this.tickRateMs,
      map: {
        width: this.map.width,
        height: this.map.height,
        tiles: Array.from(this.map.tiles.entries()),
        entities: Array.from(this.map.entities.entries()),
      },
      players: this.players,
      state: this.state,
      winners: this.winners,
      createdAt: this.createdAt,
    };
  }
}
