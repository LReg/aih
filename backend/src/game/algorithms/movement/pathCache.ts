interface CachedPath {
  cellToIdx: Map<number, number>;
  path: { x: number; y: number }[];
}

const destKey = (x: number, y: number) => `${x},${y}`;

export class PathCache {
  private cache = new Map<string, CachedPath>();

  store(toX: number, toY: number, path: { x: number; y: number }[], maxW: number) {
    const key = destKey(toX, toY);
    const cellToIdx = new Map<number, number>();
    for (let i = 0; i < path.length; i++) {
      cellToIdx.set(path[i].x * maxW + path[i].y, i);
    }
    this.cache.set(key, { cellToIdx, path });
  }

  contains(toX: number, toY: number, cellKey: number): boolean {
    const entry = this.cache.get(destKey(toX, toY));
    return entry ? entry.cellToIdx.has(cellKey) : false;
  }

  getSuffix(toX: number, toY: number, cellKey: number, maxW: number): { x: number; y: number }[] | null {
    const entry = this.cache.get(destKey(toX, toY));
    if (!entry) return null;
    const idx = entry.cellToIdx.get(cellKey);
    if (idx === undefined) return null;
    return entry.path.slice(idx);
  }

  clear() {
    this.cache.clear();
  }
}
