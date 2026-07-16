const BLOCK_SIZE = 2;
const STRIDE = BLOCK_SIZE + 1;
const BLOCK_CAPACITY = BLOCK_SIZE * BLOCK_SIZE;

export function getSpreadPositions(
  centerX: number,
  centerY: number,
  count: number,
  isAvailable: (x: number, y: number) => boolean,
  maxW: number,
  maxH: number,
  formationWidth: number = 2,
): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  if (count <= 0) return result;

  const blocksDeep = Math.max(1, Math.ceil(count / (formationWidth * BLOCK_CAPACITY)));

  for (let by = 0; by < blocksDeep; by++) {
    for (let bx = 0; bx < formationWidth; bx++) {
      if (result.length >= count) break;
      const originX = centerX + bx * STRIDE;
      const originY = centerY + by * STRIDE;

      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        if (result.length >= count) break;
        const nx = originX + ox;
        const ny = originY + oy;
        if (nx < 0 || nx >= maxW || ny < 0 || ny >= maxH) continue;
        if (!isAvailable(nx, ny)) continue;
        result.push({ x: nx, y: ny });
      }
    }
  }

  if (result.length < count) {
    const taken = new Set(result.map(p => `${p.x},${p.y}`));
    const maxRadius = Math.max(maxW, maxH);
    for (let r = 1; r <= maxRadius && result.length < count; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = centerX + dx;
          const ny = centerY + dy;
          if (nx < 0 || nx >= maxW || ny < 0 || ny >= maxH) continue;
          if (taken.has(`${nx},${ny}`)) continue;
          if (!isAvailable(nx, ny)) continue;
          taken.add(`${nx},${ny}`);
          result.push({ x: nx, y: ny });
          if (result.length >= count) return result;
        }
      }
    }
  }

  return result;
}
