import { randomUUID } from 'crypto';

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
}

const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

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

export function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function findPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  isBlocked: (x: number, y: number) => boolean,
  maxW: number,
  maxH: number,
): { x: number; y: number }[] | null {
  if (fromX === toX && fromY === toY) return [];

  const visited = new Set<string>();
  const prev = new Map<string, { x: number; y: number } | null>();
  const queue: { x: number; y: number }[] = [];
  const key = (x: number, y: number) => `${x},${y}`;

  visited.add(key(fromX, fromY));
  prev.set(key(fromX, fromY), null);
  queue.push({ x: fromX, y: fromY });

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.x === toX && cur.y === toY) break;

    for (const d of DIRS) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      const k = key(nx, ny);
      if (nx < 0 || nx >= maxW || ny < 0 || ny >= maxH) continue;
      if (visited.has(k)) continue;
      if (isBlocked(nx, ny) && !(nx === toX && ny === toY)) continue;

      visited.add(k);
      prev.set(k, cur);
      queue.push({ x: nx, y: ny });
    }
  }

  if (!prev.has(key(toX, toY))) return null;

  const path: { x: number; y: number }[] = [];
  let cur: { x: number; y: number } | null = { x: toX, y: toY };
  while (cur) {
    path.unshift(cur);
    const p = prev.get(key(cur.x, cur.y));
    cur = p || null;
  }

  return path;
}

export function getSpreadPositions(
  centerX: number,
  centerY: number,
  count: number,
  isAvailable: (x: number, y: number) => boolean,
  maxW: number,
  maxH: number,
): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];

  if (count <= 0) return result;

  if (isAvailable(centerX, centerY)) {
    result.push({ x: centerX, y: centerY });
  }

  for (let ring = 1; result.length < count; ring++) {
    let added = 0;

    for (let dx = -ring; dx <= ring && result.length < count; dx++) {
      for (let dy = -ring; dy <= ring && result.length < count; dy++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;

        const nx = centerX + dx;
        const ny = centerY + dy;
        if (nx < 0 || nx >= maxW || ny < 0 || ny >= maxH) continue;
        if (!isAvailable(nx, ny)) continue;

        result.push({ x: nx, y: ny });
        added++;
      }
    }

    if (added === 0 && ring > 5) break;
    if (ring > Math.max(maxW, maxH)) break;
  }

  return result;
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
