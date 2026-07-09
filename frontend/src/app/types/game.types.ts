export interface Tile {
  terrain: string;
  entityId?: string;
}

export type EntityState =
  | { status: 'idle' }
  | { status: 'moving'; path: { x: number; y: number }[] }
  | { status: 'moving-to-attack'; targetId: string; path: { x: number; y: number }[] }
  | { status: 'attacking'; targetId: string }
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
  tickRateMs: number;
  map: {
    width: number;
    height: number;
    tiles: [string, Tile][];
    entities: [string, Entity][];
  };
  players: string[];
  state: string;
  winners: string[];
  createdAt: string;
}

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
