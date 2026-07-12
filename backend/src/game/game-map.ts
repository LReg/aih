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

export const STATUS_OVERRIDABLE: Record<string, boolean> = {
  'building-barracks': false,
};

export function isOverridable(status: string): boolean {
  return STATUS_OVERRIDABLE[status] !== false;
}

export enum TileType {
  Grass = 'grass',
  Water = 'water',
  Mountain = 'mountain',
  Wall = 'wall',
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
  lockedTargetId?: string;
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

function seedFromString(str: string): () => number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return () => {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    return hash;
  };
}

export class GameMap {
  width: number;
  height: number;
  tiles: Map<string, Tile> = new Map();
  entities: Map<string, Entity> = new Map();
  soldiers: Map<string, Entity> = new Map();
  barracks: Map<string, Entity> = new Map();
  grid: Map<string, Set<string>> = new Map();
  cellSize: number = 6;
  dirtyEntityIds: Set<string> = new Set();
  removedEntityIds: Set<string> = new Set();

  constructor(width: number, height: number, wallSeed?: string) {
    this.width = width;
    this.height = height;
    this.fillGrass();
    this.generateWalls(wallSeed);
  }

  private cellKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  markChanged(id: string) {
    this.dirtyEntityIds.add(id);
  }

  clearDiffs() {
    this.dirtyEntityIds.clear();
    this.removedEntityIds.clear();
  }

  private addToGrid(entity: Entity) {
    const key = this.cellKey(entity.x, entity.y);
    let cell = this.grid.get(key);
    if (!cell) {
      cell = new Set();
      this.grid.set(key, cell);
    }
    cell.add(entity.id);
  }

  private removeFromGrid(entity: Entity) {
    const key = this.cellKey(entity.x, entity.y);
    const cell = this.grid.get(key);
    if (cell) {
      cell.delete(entity.id);
      if (cell.size === 0) this.grid.delete(key);
    }
  }

  private fillGrass() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.tiles.set(`${x},${y}`, { terrain: TileType.Grass });
      }
    }
  }

  private generateWalls(seed?: string) {
    const rng = seedFromString(seed || `${this.width}x${this.height}-walls-${Date.now()}`);
    const spawnZoneTop = Math.floor(this.height * 0.3);
    const spawnZoneBot = Math.floor(this.height * 0.7);
    const spawnZoneLeft = Math.floor(this.width * 0.15);
    const spawnZoneRight = Math.floor(this.width * 0.85);

    const formations = Math.floor(Math.sqrt(this.width * this.height) * 0.04);
    for (let f = 0; f < formations; f++) {
      const margin = 4;
      const sx = margin + (rng() % (this.width - margin * 2));
      const sy = margin + (rng() % (this.height - margin * 2));
      if (sy >= spawnZoneTop && sy <= spawnZoneBot && sx >= spawnZoneLeft && sx <= spawnZoneRight) continue;

      const len = 6 + (rng() % 8);
      const shape = rng() % 4;

      if (shape === 0) {
        this.drawLine(sx, sy, 1, 0, len);
      } else if (shape === 1) {
        this.drawLine(sx, sy, 0, 1, len);
      } else if (shape === 2) {
        this.drawLine(sx, sy, 1, 0, len);
        this.drawLine(sx + len - 1, sy + 1, 0, 1, 3 + (rng() % 3));
      } else {
        this.drawLine(sx, sy, 0, 1, len);
        this.drawLine(sx + 1, sy + len - 1, 1, 0, 3 + (rng() % 3));
      }
    }

    this.addCornerWalls(rng, spawnZoneTop, spawnZoneBot, spawnZoneLeft, spawnZoneRight);
  }

  private drawLine(x: number, y: number, dx: number, dy: number, len: number) {
    for (let i = 0; i < len; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (this.isInBounds(nx, ny)) this.setWall(nx, ny);
    }
  }

  private addCornerWalls(
    rng: () => number,
    top: number,
    bot: number,
    left: number,
    right: number,
  ) {
    const cornerLen = 5 + (rng() % 6);

    const corners = [
      { x: left, y: top, dx: 1, dy: 0 },
      { x: right - cornerLen, y: top, dx: 1, dy: 0 },
      { x: left, y: bot + 2, dx: 1, dy: 0 },
      { x: right - cornerLen, y: bot + 2, dx: 1, dy: 0 },
      { x: left, y: top, dx: 0, dy: 1 },
      { x: left, y: bot - cornerLen, dx: 0, dy: 1 },
      { x: right - 1, y: top, dx: 0, dy: 1 },
      { x: right - 1, y: bot - cornerLen, dx: 0, dy: 1 },
    ];

    const numCorners = 3 + (rng() % 4);
    const shuffled = [...corners];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = rng() % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (let i = 0; i < numCorners; i++) {
      const c = shuffled[i];
      this.drawLine(c.x, c.y, c.dx, c.dy, cornerLen);
    }
  }

  private setWall(x: number, y: number) {
    const tile = this.getTile(x, y);
    if (tile && tile.terrain === TileType.Grass) {
      tile.terrain = TileType.Wall;
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
    return tile !== null && !tile.entityId && tile.terrain !== TileType.Wall;
  }

  isTilePassableForMove(x: number, y: number, ownerId: string): boolean {
    const tile = this.getTile(x, y);
    if (!tile || tile.terrain === TileType.Wall) return false;
    if (!tile.entityId) return true;
    const entity = this.entities.get(tile.entityId);
    return entity !== undefined && entity.ownerId !== ownerId;
  }

  getEntityAt(x: number, y: number): Entity | undefined {
    const tile = this.getTile(x, y);
    if (!tile?.entityId) return;
    return this.entities.get(tile.entityId);
  }

  addEntity(entity: Entity) {
    this.entities.set(entity.id, entity);
    if (entity.type === 'soldier') {
      this.soldiers.set(entity.id, entity);
    } else {
      this.barracks.set(entity.id, entity);
    }
    this.addToGrid(entity);
    this.markChanged(entity.id);
    const tile = this.getTile(entity.x, entity.y);
    if (tile) tile.entityId = entity.id;
  }

  removeEntity(id: string) {
    const entity = this.entities.get(id);
    if (entity) {
      this.removeFromGrid(entity);
      if (entity.type === 'soldier') {
        this.soldiers.delete(id);
      } else {
        this.barracks.delete(id);
      }
      const tile = this.getTile(entity.x, entity.y);
      if (tile) tile.entityId = undefined;
      this.dirtyEntityIds.delete(id);
      this.removedEntityIds.add(id);
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
    for (const entity of this.barracks.values()) {
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

    this.removeFromGrid(entity);

    const oldTile = this.getTile(entity.x, entity.y);
    if (oldTile) oldTile.entityId = undefined;

    entity.x = nx;
    entity.y = ny;

    this.addToGrid(entity);

    const newTile = this.getTile(nx, ny);
    if (newTile) newTile.entityId = entity.id;

    this.markChanged(id);
  }
}