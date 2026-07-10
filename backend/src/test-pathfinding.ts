/**
 * Pathfinding performance test.
 * Run: npm run compile && node dist/test-pathfinding.js
 */

import { Game } from './game/game';
import { GameMap, createSoldier, Entity } from './game/game-map';
import { Gamemode } from './game/gamemode.config';
import { walkAction } from './game/actions/walk.action';
import { processGame } from './game/processing/processing';

function formatNs(ns: number): string {
  if (ns < 1000) return `${ns.toFixed(0)}ns`;
  if (ns < 1_000_000) return `${(ns / 1000).toFixed(1)}µs`;
  return `${(ns / 1_000_000).toFixed(2)}ms`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function main() {
  const MAP_W = 100;
  const MAP_H = 100;
  const SOLDIER_COUNT = 350;
  const TICK_COUNT = 500;
  const DEST_X = 80;
  const DEST_Y = 80;
  const ALT_DEST_X = 20;
  const ALT_DEST_Y = 20;

  console.log('=== Pathfinding Performance Test ===\n');
  console.log(`Map: ${MAP_W}x${MAP_H}`);
  console.log(`Soldiers: ${SOLDIER_COUNT}`);
  console.log(`Ticks: ${TICK_COUNT}`);
  console.log(`Main destination: (${DEST_X},${DEST_Y})`);
  console.log(`Alt destination: (${ALT_DEST_X},${ALT_DEST_Y})\n`);

  // --- Setup ---
  const map = new GameMap(MAP_W, MAP_H);
  const soldiers: Entity[] = [];

  // Place 100 soldiers in a start zone (top-left quarter)
  let placed = 0;
  for (let y = 1; y < MAP_H / 2 - 1 && placed < SOLDIER_COUNT; y++) {
    for (let x = 1; x < MAP_W / 2 - 1 && placed < SOLDIER_COUNT; x++) {
      if (placed >= SOLDIER_COUNT) break;
      const s = createSoldier('player1', x, y);
      map.addEntity(s);
      soldiers.push(s);
      placed++;
    }
  }
  console.log(`Placed ${soldiers.length} soldiers on map`);

  const players = ['player1'];
  const game = new Game(Gamemode.Test, map, players);
  game.state = 'running';

  // --- Create action queue just like the frontend would ---
  // 330 soldiers move to (80,80), 20 move to (20,20)
  const mainGroup = soldiers.slice(0, 330);
  const altGroup = soldiers.slice(330);

  const mainIds = mainGroup.map(s => s.id);
  const altIds = altGroup.map(s => s.id);

  // Walk action: manually invoke walkAction to set targets + spread
  walkAction(game, {
    id: 'test-action-1',
    playerId: 'player1',
    type: 'walk',
    payload: { entityIds: mainIds, x: DEST_X, y: DEST_Y },
    timestamp: Date.now(),
  });

  walkAction(game, {
    id: 'test-action-2',
    playerId: 'player1',
    type: 'walk',
    payload: { entityIds: altIds, x: ALT_DEST_X, y: ALT_DEST_Y },
    timestamp: Date.now(),
  });

  const moving = [...game.map.entities.values()].filter(e => e.state.status === 'moving');
  console.log(`Moving entities after actions: ${moving.length}`);

  // --- Run ticks with timing ---
  const pathfindTimes: number[] = [];
  const totalTimes: number[] = [];
  let arrivedCount = 0;
  let stuckCount = 0;
  let totalPathLengths = 0;
  let pathLengthSamples = 0;

  for (let tick = 0; tick < TICK_COUNT; tick++) {
    game.tick = tick;
    const t0 = process.hrtime.bigint();
    processGame(game);
    const dt = Number(process.hrtime.bigint() - t0);
    totalTimes.push(dt);

    // Sample path lengths every 10 ticks
    if (tick % 10 === 0) {
      for (const entity of game.map.entities.values()) {
        if (entity.path && entity.path.length > 1) {
          totalPathLengths += entity.path.length;
          pathLengthSamples++;
        }
      }
    }

    // Report every 50 ticks
    if ((tick + 1) % 50 === 0) {
      const moving = [...game.map.entities.values()].filter(e => e.state.status === 'moving').length;
      const arrived = [...game.map.entities.values()].filter(e => {
        if (e.state.status !== 'moving') return false;
        const s = e.state as { status: 'moving'; targetX: number; targetY: number };
        return e.x === s.targetX && e.y === s.targetY;
      }).length;
      const stuck = moving - arrived;
      const avgTime = formatNs(totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length);
      const maxTime = formatNs(Math.max(...totalTimes));
      console.log(`  Tick ${tick + 1}: arrived=${arrived} stuck=${stuck} avg=${avgTime} max=${maxTime}`);
    }
  }

  // --- Report ---
  console.log('\n=== Results ===\n');

  const avgTick = totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length;
  const maxTick = Math.max(...totalTimes);
  const minTick = Math.min(...totalTimes);
  console.log(`Tick timing (${totalTimes.length} ticks):`);
  console.log(`  Avg: ${formatNs(avgTick)}`);
  console.log(`  Min: ${formatNs(minTick)}`);
  console.log(`  Max: ${formatNs(maxTick)}`);

  // Percentiles
  const sorted = [...totalTimes].sort((a, b) => a - b);
  console.log(`  P50:  ${formatNs(sorted[Math.floor(sorted.length * 0.50)])}`);
  console.log(`  P95:  ${formatNs(sorted[Math.floor(sorted.length * 0.95)])}`);
  console.log(`  P99:  ${formatNs(sorted[Math.floor(sorted.length * 0.99)])}`);

  const arrived = [...game.map.entities.values()].filter(e => {
    if (e.state.status !== 'moving') return false;
    const s = e.state as { status: 'moving'; targetX: number; targetY: number };
    return e.x === s.targetX && e.y === s.targetY;
  }).length;
  const stillMoving = [...game.map.entities.values()].filter(e => e.state.status === 'moving').length;
  const stuck = stillMoving - arrived;
  console.log(`\nArrived at target: ${arrived} / ${SOLDIER_COUNT}`);
  console.log(`Still en route (stuck): ${stuck} / ${SOLDIER_COUNT}`);

  const withPaths = [...game.map.entities.values()].filter(e => e.path !== undefined).length;
  console.log(`Entities with cached paths: ${withPaths}`);

  if (pathLengthSamples > 0) {
    console.log(`Avg path length sampled: ${(totalPathLengths / pathLengthSamples).toFixed(1)} tiles`);
  }

  // Memory estimate
  const pathBytes = [...game.map.entities.values()].reduce((sum, e) => {
    if (e.path) return sum + e.path.length * 8 + 32;
    return sum;
  }, 0);
  console.log(`Estimated path memory: ${(pathBytes / 1024).toFixed(1)}KB`);

  console.log('\n=== Test Complete ===');
}

main();
