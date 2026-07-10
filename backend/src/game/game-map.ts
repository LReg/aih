import { randomUUID } from 'crypto';
import { DIRS } from './algorithms/findPath';

export type EntityType = 'soldier' | 'barracks';

export type EntityState =
  | { status: 'idle' }
  | { status: 'moving'; targetX: number; targetY: number }
  | { status: 'attacking'; targetX: number; targetY: number }
  | { status: 'building-barracks'; startedAtTick: number }
  | { status: 'building'; startedAtTick: number }
  | { status: 'ready'; lastProducedAtTick: number };

export enum TileType {
  Grass = 'grass',
  Water = 'water',
  Mountain = 'mountain',
}

export interface Tile {
  terrain: TileType;
  entityId?: string;
}

export interface Entity {
  id: string;
  ownerId: string;
  type: EntityType;
  x: number;
  y: number;
  state: EntityState;
  lastCommand?: string;
  path?: { x: number; y: number }[];
  pathIndex?: number;
}

export function createSoldier(ownerId: string, x: number, y: number): Entity {
  return {
    id: randomUUID(),
    ownerId,
    type: 'soldier',
    x,
    y,
    state: { status: 'idle' },
  };
}

export function createBarracks(ownerId: string, x: number, y: number, tick: number): Entity {
  return {
    id: randomUUID(),
    ownerId,
    type: 'barracks',
    x,
    y,
    state: { status: 'building', startedAtTick: tick },
  };
}

export class GameMap {
  width: number;
  height: number;
  tiles: Map<string, Tile> = new Map();
  entities: Map<string, Entity> = new Map();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.fillGrass();
  }

  private fillGrass() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.tiles.set(`${x},${y}`, { terrain: TileType.Grass });
      }
    }
  }

  getTile(x: number, y: number): Tile | null {
    return this.tiles.get(`${x},${y}`) || null;
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  isTileEmpty(x: number, y: number): boolean {
    const tile = this.getTile(x, y);
    return tile !== null && !tile.entityId;
  }

  getEntityAt(x: number, y: number): Entity | undefined {
    const tile = this.getTile(x, y);
    if (!tile?.entityId) return;
    return this.entities.get(tile.entityId);
  }

  addEntity(entity: Entity) {
    this.entities.set(entity.id, entity);
    const tile = this.getTile(entity.x, entity.y);
    if (tile) tile.entityId = entity.id;
  }

  removeEntity(id: string) {
    const entity = this.entities.get(id);
    if (entity) {
      const tile = this.getTile(entity.x, entity.y);
      if (tile) tile.entityId = undefined;
    }
    this.entities.delete(id);
  }

  findNearestEmptyTile(x: number, y: number): { x: number; y: number } | null {
    for (const d of DIRS) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (this.isInBounds(nx, ny) && this.isTileEmpty(nx, ny)) {
        return { x: nx, y: ny };
      }
    }
    return null;
  }

  isNearBarracks(x: number, y: number): boolean {
    for (const entity of this.entities.values()) {
      if (entity.type !== 'barracks') continue;
      if (Math.abs(entity.x - x) <= 1 && Math.abs(entity.y - y) <= 1) return true;
    }
    return false;
  }

  findNearestEmptyTileAvoidBarracks(x: number, y: number): { x: number; y: number } | null {
    for (const d of DIRS) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (this.isInBounds(nx, ny) && this.isTileEmpty(nx, ny) && !this.isNearBarracks(nx, ny)) {
        return { x: nx, y: ny };
      }
    }
    return null;
  }

  getEntitiesByOwner(ownerId: string): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.ownerId === ownerId) result.push(entity);
    }
    return result;
  }

  moveEntity(id: string, nx: number, ny: number) {
    const entity = this.entities.get(id);
    if (!entity) return;

    const oldTile = this.getTile(entity.x, entity.y);
    if (oldTile) oldTile.entityId = undefined;

    entity.x = nx;
    entity.y = ny;

    const newTile = this.getTile(nx, ny);
    if (newTile) newTile.entityId = entity.id;
  }
}
