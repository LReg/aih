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
  '#22c55e', '#eab308', '#ef4444', '#3b82f6',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
  '#06b6d4', '#84cc16', '#8b5cf6', '#f43f5e',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
    const shuffled = shuffle(COLORS);
    this.playerColors = {};
    for (let i = 0; i < players.length; i++) {
      this.playerColors[players[i]] = shuffled[i % shuffled.length];
    }
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
