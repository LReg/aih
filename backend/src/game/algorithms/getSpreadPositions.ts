import { manhattan } from './findPath';

export function assignTargetsByDistance(
  positions: { x: number; y: number }[],
  targets: { x: number; y: number }[],
): number[] {
  const assigned = new Set<number>();
  const result = new Array<number>(positions.length);

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let j = 0; j < targets.length; j++) {
      if (assigned.has(j)) continue;
      const d = manhattan(p, targets[j]);
      if (d < bestDist) { bestDist = d; bestIdx = j; }
    }
    assigned.add(bestIdx);
    result[i] = bestIdx;
  }

  return result;
}
