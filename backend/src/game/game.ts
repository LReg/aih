import { randomUUID } from 'crypto';
import { GameMap, TileType } from './game-map';
import { Gamemode } from './gamemode.config';

export type GameState = 'waiting' | 'countdown' | 'running' | 'finished';

export interface QueuedAction {
  id: string;
  playerId: string;
  type: string;
  payload: unknown;
  timestamp: number;
}

const COLORS = [
  '#ef4444', '#3b82f6', '#eab308', '#22c55e',
  '#f97316', '#a855f7', '#14b8a6', '#ec4899',
  '#84cc16', '#06b6d4', '#8b5cf6', '#f43f5e',
];

export class Game {
  readonly id: string = randomUUID();
  state: GameState = 'waiting';
  tick: number = 0;
  startedAt: number = 0;
  peaceUntil: number = 0;
  tickRateMs: number = 500;
  actionQueue: QueuedAction[] = [];
  winners: string[] = [];
  losers: string[] = [];
  playerColors: Record<string, string>;

  constructor(
    public readonly gamemode: Gamemode,
    public readonly map: GameMap,
    public readonly players: string[],
    public readonly createdAt: Date = new Date(),
  ) {
    this.playerColors = {};
    for (let i = 0; i < players.length; i++) {
      this.playerColors[players[i]] = COLORS[i % COLORS.length];
    }
  }

  destroy() {
    this.actionQueue.length = 0;
    this.map.entities.clear();
    this.map.tiles.clear();
    this.players.length = 0;
    this.winners.length = 0;
    this.losers.length = 0;
  }

  toJSON() {
    return {
      id: this.id,
      gamemode: this.gamemode,
      tick: this.tick,
      startedAt: this.startedAt,
      peaceUntil: this.peaceUntil,
      tickRateMs: this.tickRateMs,
      map: {
        width: this.map.width,
        height: this.map.height,
        tiles: Array.from(this.map.tiles.entries()).filter(([, t]) => t.terrain !== TileType.Grass),
        entities: Array.from(this.map.entities.entries()),
      },
      players: this.players,
      playerColors: this.playerColors,
      state: this.state,
      winners: this.winners,
      losers: this.losers,
      createdAt: this.createdAt,
    };
  }
}
