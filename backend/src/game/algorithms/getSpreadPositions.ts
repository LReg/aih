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
