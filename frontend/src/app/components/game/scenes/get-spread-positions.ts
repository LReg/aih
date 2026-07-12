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

  const taken = new Set<string>();

  function add(x: number, y: number): boolean {
    const k = `${x},${y}`;
    if (taken.has(k)) return false;
    taken.add(k);
    result.push({ x, y });
    return true;
  }

  if (isAvailable(centerX, centerY)) {
    add(centerX, centerY);
  }
  if (result.length >= count) return result;

  const BLOCK_COLS = 2;
  const BLOCK_ROWS = 3;
  const STRIDE_COL = BLOCK_COLS + 1;
  const STRIDE_ROW = BLOCK_ROWS + 1;

  const startX = Math.max(0, Math.min(centerX - 1, maxW - BLOCK_COLS));
  const startY = Math.max(0, Math.min(centerY - 3, maxH - BLOCK_ROWS));

  for (let layer = 0; layer <= 50; layer++) {
    let blocksAdded = 0;

    for (let bx = -layer; bx <= layer; bx++) {
      for (let by = -layer; by <= layer; by++) {
        if (Math.abs(bx) !== layer && Math.abs(by) !== layer) continue;

        const baseX = startX + bx * STRIDE_COL;
        const baseY = startY + by * STRIDE_ROW;

        let blockValid = true;
        for (let c = 0; c < BLOCK_COLS && blockValid; c++) {
          for (let r = 0; r < BLOCK_ROWS && blockValid; r++) {
            const nx = baseX + c;
            const ny = baseY + r;
            if (nx < 0 || nx >= maxW || ny < 0 || ny >= maxH) { blockValid = false; break; }
            if (result.length > 0 && nx === centerX && ny === centerY) continue;
            if (!isAvailable(nx, ny)) { blockValid = false; break; }
          }
        }

        if (!blockValid) continue;
        blocksAdded++;
        if (result.length >= count) return result;

        for (let c = 0; c < BLOCK_COLS; c++) {
          for (let r = 0; r < BLOCK_ROWS; r++) {
            const nx = baseX + c;
            const ny = baseY + r;
            if (result.length > 0 && nx === centerX && ny === centerY) continue;
            add(nx, ny);
            if (result.length >= count) return result;
          }
        }
      }
    }

    if (blocksAdded === 0 && layer > 3) {
      break;
    }
  }

  if (result.length < count) {
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
          add(nx, ny);
          if (result.length >= count) return result;
        }
      }
    }
  }

  return result;
}
