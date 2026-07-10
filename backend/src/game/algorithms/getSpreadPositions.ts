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
  if (result.length >= count) return result;

  const BLOCK_COLS = 2;
  const BLOCK_ROWS = 6;
  const STRIDE_COL = BLOCK_COLS + 1;
  const STRIDE_ROW = BLOCK_ROWS + 1;

  const startX = centerX - 1;
  const startY = centerY - 3;

  for (let maxDim = 0; result.length < count; maxDim++) {
    for (let bx = 0; bx <= maxDim && result.length < count; bx++) {
      for (let by = 0; by <= maxDim && result.length < count; by++) {
        if (bx !== maxDim && by !== maxDim) continue;

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

        for (let c = 0; c < BLOCK_COLS && result.length < count; c++) {
          for (let r = 0; r < BLOCK_ROWS && result.length < count; r++) {
            const nx = baseX + c;
            const ny = baseY + r;
            if (result.length > 0 && nx === centerX && ny === centerY) continue;
            result.push({ x: nx, y: ny });
          }
        }
      }
    }
  }

  return result;
}
