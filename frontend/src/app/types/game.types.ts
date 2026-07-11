export enum TileType {
  Grass = 'grass',
  Water = 'water',
  Mountain = 'mountain',
}

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
