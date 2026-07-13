export enum TileType {
  Grass = 'grass',
  Water = 'water',
  Mountain = 'mountain',
  Wall = 'wall',
}

export const TERRAIN_COLORS: Record<TileType, number> = {
  [TileType.Grass]: 0x3a5f0b,
  [TileType.Water]: 0x1a5276,
  [TileType.Mountain]: 0x5d4037,
  [TileType.Wall]: 0x2d2d2d,
};

export interface Tile {
  terrain: TileType;
  entityId?: string;
}

export type EntityState =
  | { status: 'idle' }
  | { status: 'moving'; targetX: number; targetY: number }
  | { status: 'attacking'; targetX: number; targetY: number }
  | { status: 'building-barracks'; startedAtTick: number }
  | { status: 'building'; startedAtTick: number }
  | { status: 'ready'; lastProducedAtTick: number };

export const STATUS_OVERRIDABLE: Record<string, boolean> = {
  'building-barracks': false,
};

export function isOverridable(status: string): boolean {
  return STATUS_OVERRIDABLE[status] !== false;
}

export interface Entity {
  id: string;
  ownerId: string;
  type: 'soldier' | 'barracks';
  x: number;
  y: number;
  state: EntityState;
  lastCommand?: string;
}

export interface GameState {
  id: string;
  gamemode: string;
  tick: number;
  startedAt: number;
  peaceUntil: number;
  tickRateMs: number;
  maxBarracks: number;
  darknessRange: number;
  map: {
    width: number;
    height: number;
    tiles: [string, Tile][];
    entities: [string, Entity][];
  };
  players: string[];
  playerColors: Record<string, string>;
  state: string;
  winners: string[];
  losers: string[];
  createdAt: string;
}

export interface GameStateDiff {
  tick: number;
  diff: true;
  changed: [string, Entity][];
  removed: string[];
}

export type StateUpdate = GameState | GameStateDiff;

export interface CountdownEvent {
  gamemode: string;
  seconds: number;
  playerIds: string[];
}

export interface GameFoundEvent {
  gamemode: string;
  gameId: string;
  players: string[];
}

export interface ActionResponse {
  accepted: boolean;
  actionId?: string;
}

export interface LobbySettings {
  gamemode: string;
  maxPlayers: number;
  mapWidth: number;
  mapHeight: number;
  tickRateMs: number;
  peaceDurationMs: number;
  startingSoldiers: number;
  maxBarracks: number;
  darknessRange: number;
  barracksBuildTime: number;
  soldierProductionTime: number;
}

export interface LobbyData {
  id: string;
  hostId: string;
  players: string[];
  settings: LobbySettings;
  createdAt: string;
}

export interface LobbyStartedEvent {
  gameId: string;
  players: string[];
  gamemode: string;
}
