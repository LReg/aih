import { PathCache } from './movement/pathCache';

export const USE_PATH_CACHE = true;

export const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

export function manhattan(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

class MinHeap {
  private data: { x: number; y: number; f: number }[] = [];

  push(item: { x: number; y: number; f: number }) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }

  pop(): { x: number; y: number; f: number } | undefined {
    if (this.data.length === 0) return;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() { return this.data.length; }

  private _bubbleUp(idx: number) {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.data[idx].f >= this.data[parent].f) break;
      [this.data[idx], this.data[parent]] = [this.data[parent], this.data[idx]];
      idx = parent;
    }
  }

  private _sinkDown(idx: number) {
    const len = this.data.length;
    while (true) {
      let smallest = idx;
      const left = (idx << 1) + 1;
      const right = left + 1;
      if (left < len && this.data[left].f < this.data[smallest].f) smallest = left;
      if (right < len && this.data[right].f < this.data[smallest].f) smallest = right;
      if (smallest === idx) break;
      [this.data[idx], this.data[smallest]] = [this.data[smallest], this.data[idx]];
      idx = smallest;
    }
  }
}

function reconstructPath(
  cameFrom: Map<number, { x: number; y: number } | null>,
  key: (x: number, y: number) => number,
  toX: number,
  toY: number,
): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [];
  let c: { x: number; y: number } | null = { x: toX, y: toY };
  while (c) {
    path.unshift(c);
    const p = cameFrom.get(key(c.x, c.y));
    c = p || null;
  }
  return path;
}

export function findPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  isBlocked: (x: number, y: number) => boolean,
  maxW: number,
  maxH: number,
  pathCache?: PathCache,
): { x: number; y: number }[] | null {
  if (fromX === toX && fromY === toY) return [];

  const key = (x: number, y: number) => x * maxW + y;
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, { x: number; y: number } | null>();
  const open = new MinHeap();
  const closed = new Set<number>();

  const startKey = key(fromX, fromY);
  gScore.set(startKey, 0);
  cameFrom.set(startKey, null);
  open.push({ x: fromX, y: fromY, f: manhattan({ x: fromX, y: fromY }, { x: toX, y: toY }) });

  let bestNode = { x: fromX, y: fromY };
  let bestDist = manhattan({ x: fromX, y: fromY }, { x: toX, y: toY });

  while (open.size > 0) {
    const cur = open.pop()!;
    const curKey = key(cur.x, cur.y);

    if (closed.has(curKey)) continue;
    closed.add(curKey);

    if (USE_PATH_CACHE && pathCache && pathCache.contains(toX, toY, curKey)) {
      const prefix = reconstructPath(cameFrom, key, cur.x, cur.y);
      const suffix = pathCache.getSuffix(toX, toY, curKey, maxW)!;
      let valid = true;
      for (let i = 1; i < suffix.length; i++) {
        if (isBlocked(suffix[i].x, suffix[i].y)) { valid = false; break; }
      }
      if (valid) return prefix.concat(suffix.slice(1));
    }

    const curDist = manhattan({ x: cur.x, y: cur.y }, { x: toX, y: toY });
    if (curDist < bestDist) {
      bestDist = curDist;
      bestNode = { x: cur.x, y: cur.y };
    }

    if (cur.x === toX && cur.y === toY) {
      const result = reconstructPath(cameFrom, key, toX, toY);
      if (USE_PATH_CACHE && pathCache) pathCache.store(toX, toY, result, maxW);
      return result;
    }

    const curG = gScore.get(curKey)!;

    for (const d of DIRS) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      const nk = key(nx, ny);

      if (nx < 0 || nx >= maxW || ny < 0 || ny >= maxH) continue;
      if (closed.has(nk)) continue;
      if (isBlocked(nx, ny) && !(nx === toX && ny === toY)) continue;

      const tentativeG = curG + 1;
      const existingG = gScore.get(nk);
      if (existingG !== undefined && tentativeG >= existingG) continue;

      gScore.set(nk, tentativeG);
      cameFrom.set(nk, { x: cur.x, y: cur.y });
      open.push({ x: nx, y: ny, f: tentativeG + manhattan({ x: nx, y: ny }, { x: toX, y: toY }) });
    }
  }

  const result = reconstructPath(cameFrom, key, bestNode.x, bestNode.y);
  if (USE_PATH_CACHE && pathCache && result.length > 1) pathCache.store(toX, toY, result, maxW);
  return result;
}
