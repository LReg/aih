import { randomUUID } from 'crypto';
import { GameMap, Entity, TileType } from './game-map';
import { Gamemode } from './gamemode.config';
import type { GamemodeConfig } from './gamemode.config';

export const PROD_MULT_MAX = 3.0;
export const PROD_MULT_MIN = 0.40

export function productionMultiplier(soldierCount: number, mid: number): number {
  const ratio = (mid - soldierCount) / mid;
  const mult = ratio >= 0
    ? 1 + ratio * (PROD_MULT_MAX - 1)
    : 1 + ratio * (1 - PROD_MULT_MIN);
  return Math.min(PROD_MULT_MAX, Math.max(PROD_MULT_MIN, mult));
}

export type GameState = 'waiting' | 'countdown' | 'running' | 'finished';

export interface QueuedAction {
  id: string;
  playerId: string;
  type: string;
  payload: unknown;
  timestamp: number;
}

export interface Effect {
  type: 'arrow' | 'melee';
  fromId: string;
  toId: string;
  fromTileX: number;
  fromTileY: number;
  toTileX: number;
  toTileY: number;
}

const COLORS = [
  '#ef4444', '#3b82f6', '#eab308', '#22c55e',
  '#f97316', '#a855f7', '#14b8a6', '#ec4899',
  '#84cc16', '#06b6d4', '#8b5cf6', '#f43f5e',
];

export class Game {
  readonly id: string;
  state: GameState = 'waiting';
  tick: number = 0;
  startedAt: number = 0;
  peaceUntil: number = 0;
  tickRateMs: number = 500;
  config!: GamemodeConfig;
  actionQueue: QueuedAction[] = [];
  effects: Effect[] = [];
  winners: string[] = [];
  losers: string[] = [];
  eliminationOrder: string[] = [];
  playerColors: Record<string, string>;
  playerNames: Record<string, string> = {};

  constructor(
    public readonly gamemode: Gamemode,
    public readonly map: GameMap,
    public readonly players: string[],
    public readonly createdAt: Date = new Date(),
    id?: string,
  ) {
    this.id = id || randomUUID();
    this.playerColors = {};
    for (let i = 0; i < players.length; i++) {
      this.playerColors[players[i]] = COLORS[i % COLORS.length];
    }
  }

  destroy() {
    this.actionQueue.length = 0;
    this.map.entities.clear();
    this.map.soldiers.clear();
    this.map.barracks.clear();
    this.map.grid.clear();
    this.map.tiles.clear();
    this.players.length = 0;
    this.winners.length = 0;
    this.losers.length = 0;
    this.eliminationOrder.length = 0;
  }

  private serializeEntity(e: Entity): Record<string, unknown> {
    return {
      id: e.id,
      ownerId: e.ownerId,
      type: e.type,
      class: e.class,
      x: e.x,
      y: e.y,
      state: e.state,
      lastCommand: e.lastCommand,
      hp: e.hp,
      maxHp: e.maxHp,
    };
  }

  consumeEffects(): Effect[] {
    const eff = this.effects;
    this.effects = [];
    return eff;
  }

  getProductionMultipliers(): Record<string, number> {
    const result: Record<string, number> = {};
    const counts = new Map<string, number>();
    for (const e of this.map.soldiers.values()) {
      counts.set(e.ownerId, (counts.get(e.ownerId) || 0) + 1);
    }
    for (const playerId of this.players) {
      result[playerId] = productionMultiplier(counts.get(playerId) || 0, this.config.midSoldierCount);
    }
    return result;
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
        entities: Array.from(this.map.entities.entries()).map(
          ([id, e]) => [id, this.serializeEntity(e)] as [string, Record<string, unknown>],
        ),
      },
      maxBarracks: this.config.maxBarracks,
      darknessRange: this.config.darknessRange,
      players: this.players,
      playerColors: this.playerColors,
      playerNames: this.playerNames,
      state: this.state,
      winners: this.winners,
      losers: this.losers,
      eliminationOrder: this.eliminationOrder,
      createdAt: this.createdAt,
      productionMultipliers: this.getProductionMultipliers(),
    };
  }

  toDiffJSON() {
    const changed: [string, Record<string, unknown>][] = [];
    for (const id of this.map.dirtyEntityIds) {
      const e = this.map.entities.get(id);
      if (e) changed.push([id, this.serializeEntity(e)]);
    }
    const removed = [...this.map.removedEntityIds];
    this.map.clearDiffs();
    return {
      tick: this.tick,
      diff: true as const,
      changed,
      removed,
      productionMultipliers: this.getProductionMultipliers(),
    };
  }
}
