const PERF_LOG = true;

const marks = new Map<string, number>();
const counters = new Map<string, { sum: number; count: number }>();

let lastFrameTime = 0;
let totalFrameDt = 0;
let frameCount = 0;
let renderer: any = null;
let displayList: any = null;
let updateList: any = null;
let childrenCount = 0;
let texCount = 0;

export function perfStart(label: string) {
  if (!PERF_LOG) return;
  marks.set(label, performance.now());
}

export function perfEnd(label: string) {
  if (!PERF_LOG) return;
  const start = marks.get(label);
  if (start === undefined) return;
  const dt = performance.now() - start;
  let c = counters.get(label);
  if (!c) { c = { sum: 0, count: 0 }; counters.set(label, c); }
  c.sum += dt;
  c.count++;
}

export function perfLog() {
  if (!PERF_LOG || counters.size === 0) return;
  const avgDt = frameCount > 0 ? (totalFrameDt / frameCount).toFixed(1) : '?';
  const lines: string[] = [];
  for (const [label, c] of counters) {
    const avg = (c.sum / c.count).toFixed(2);
    lines.push(`${label}: avg=${avg}ms calls=${c.count} total=${c.sum.toFixed(2)}ms`);
  }
  lines.push(`frameGap=${avgDt}ms frames=${frameCount}`);
  if (renderer) {
    lines.push(`drawCalls=${renderer.drawCallCount ?? renderer.drawCount ?? '?'}`);
    lines.push(`tris=${renderer.triangleCount ?? '?'}`);
  }
  if (displayList) {
    lines.push(`objs=${displayList.length}`);
  }
  lines.push(`children=${childrenCount}`);
  lines.push(`tex=${texCount}`);
  if (updateList) {
    lines.push(`updates=${(updateList.list ?? updateList).length}`);
  }
  console.log('[PERF] ' + lines.join(' | '));
  counters.clear();
  totalFrameDt = 0;
  frameCount = 0;
}

let logTimer: ReturnType<typeof setInterval> | null = null;

export function perfFrame(scene: Phaser.Scene, renderTimeMs?: number, emSprites?: number, emDots?: number) {
  if (!PERF_LOG) return;
  try {
    renderer = scene.game.renderer;
    displayList = (scene.sys.displayList as any);
    updateList = (scene.sys.updateList as any);
    childrenCount = scene.children.length;
    texCount = (scene.textures as any).getTextureKeys?.()?.length ?? 0;
    if (emSprites !== undefined) {
      let c = counters.get('sprites');
      if (!c) { c = { sum: 0, count: 0 }; counters.set('sprites', c); }
      c.sum += emSprites;
      c.count++;
    }
    if (emDots !== undefined) {
      let c = counters.get('dots');
      if (!c) { c = { sum: 0, count: 0 }; counters.set('dots', c); }
      c.sum += emDots;
      c.count++;
    }
    if (renderTimeMs !== undefined) {
      let c = counters.get('render');
      if (!c) { c = { sum: 0, count: 0 }; counters.set('render', c); }
      c.sum += renderTimeMs;
      c.count++;
    }
    const now = performance.now();
    if (lastFrameTime > 0) {
      const dt = now - lastFrameTime;
      totalFrameDt += dt;
      frameCount++;
    }
    lastFrameTime = now;
  } catch (_e) { /* noop */ }
}

export function perfInit() {
  if (!PERF_LOG) return;
  if (logTimer) clearInterval(logTimer);
  logTimer = setInterval(perfLog, 5000);
}
