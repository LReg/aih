import { parentPort } from 'worker_threads';
import { Game } from './game';
import { GameMap, createSoldier } from './game-map';
import { GAMEMODE_CONFIGS } from './gamemode.config';
import type { GamemodeConfig } from './gamemode.config';
import { processActions, queueGameAction } from './actions/actions';
import { processGame } from './processing/processing';

const games = new Map<string, Game>();
const ticks = new Map<string, NodeJS.Timeout>();
const CLEANUP_DELAY_MS = 300_000;

function spawnCluster(game: Game, ownerId: string, cx: number, cy: number, count: number): number {
  let placed = 0;
  const maxR = Math.ceil(Math.sqrt(count));
  for (let dy = -maxR; dy <= maxR && placed < count; dy++) {
    for (let dx = -maxR; dx <= maxR && placed < count; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (game.map.isInBounds(x, y) && game.map.isTileEmpty(x, y)) {
        const soldier = createSoldier(ownerId, x, y);
        game.map.addEntity(soldier);
        placed++;
      }
    }
  }
  return placed;
}

function generateSpawnPositions(map: GameMap, count: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const cx = Math.floor(map.width / 2);
  const cy = Math.floor(map.height / 2);
  const R = Math.min(cx, cy) - 15;

  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const x = Math.floor(cx + R * Math.cos(angle));
    const y = Math.floor(cy + R * Math.sin(angle));

    // Small local search for empty tile
    let found = false;
    for (let dy = -2; dy <= 2 && !found; dy++) {
      for (let dx = -2; dx <= 2 && !found; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (map.isInBounds(px, py) && map.isTileEmpty(px, py)) {
          positions.push({ x: px, y: py });
          found = true;
        }
      }
    }
    if (!found) positions.push({ x, y });
  }

  return positions;
}

function spawnPlayers(game: Game, countPerPlayer: number) {
  const playerPositions = generateSpawnPositions(game.map, game.players.length);
  for (let i = 0; i < game.players.length; i++) {
    const center = playerPositions[i];
    spawnCluster(game, game.players[i], center.x, center.y, countPerPlayer);
  }
}

function startTick(gameId: string, rateMs: number) {
  const interval = setInterval(() => tick(gameId), rateMs);
  ticks.set(gameId, interval);
}

function stopTick(gameId: string) {
  const interval = ticks.get(gameId);
  if (!interval) return;
  clearInterval(interval);
  ticks.delete(gameId);
}

function tick(gameId: string) {
  const game = games.get(gameId);
  if (!game || game.state !== 'running') return;

  const tickStart = performance.now();
  game.tick++;
  game.effects = [];
  const actions = game.actionQueue.splice(0, game.actionQueue.length);
  processActions(game, actions);
  processGame(game);
  const tickCalcTime = Math.round(performance.now() - tickStart - game.tickRateMs);
  const effects = game.consumeEffects();

  const config = GAMEMODE_CONFIGS[game.gamemode];
  let winners: string[] = [];

  if (game.tick > 10) {
    winners = config.winCondition(game);
  }

  if (winners.length > 0) {
    game.winners = winners;
    game.state = 'finished';
    stopTick(game.id);
    parentPort?.postMessage({ type: 'gameEnd', gameId: game.id, winners, state: game.toJSON() });
    setTimeout(() => {
      game.destroy();
      games.delete(game.id);
    }, CLEANUP_DELAY_MS);
    return;
  }

  // Every tick: send diff (mutable objects -> JSON string to avoid structured clone)
  parentPort?.postMessage({ type: 'stateDiff', gameId: game.id, diff: game.toDiffJSON(), tickCalcTime, effects });

  // First 10 ticks + every 10th thereafter: send full state for client verification
  if (game.tick <= 10 || game.tick % 10 === 0) {
    parentPort?.postMessage({ type: 'stateUpdate', gameId: game.id, state: game.toJSON(), tickCalcTime, effects });
  }
}

parentPort?.on('message', (msg) => {
  switch (msg.type) {
    case 'init': {
      const config = msg.config as any;
      const game = new Game(msg.gamemode, new GameMap(config.mapWidth, config.mapHeight, msg.gameId), msg.players, new Date(), msg.gameId);
      game.config = config;
      spawnPlayers(game, config.startingSoldiers);
      game.state = 'running';
      game.tick = 0;
      game.startedAt = Date.now();
      game.peaceUntil = Date.now() + config.peaceDurationMs;
      game.tickRateMs = config.tickRateMs;
      games.set(game.id, game);
      startTick(game.id, config.tickRateMs);
      parentPort?.postMessage({ type: 'gameStart', gameId: game.id, players: game.players, gamemode: game.gamemode, state: game.toJSON() });
      break;
    }
    case 'action': {
      const game = games.get(msg.gameId);
      if (!game) return;
      const result = queueGameAction(game, msg.playerId, msg.body);
      parentPort?.postMessage({ type: 'actionResult', gameId: msg.gameId, ...result });
      break;
    }
    case 'stop': {
      const game = games.get(msg.gameId);
      if (game) {
        stopTick(msg.gameId);
        game.destroy();
        games.delete(msg.gameId);
      }
      break;
    }
    case 'getState': {
      const game = games.get(msg.gameId);
      if (game) {
        parentPort?.postMessage({ type: 'stateSnapshot', gameId: msg.gameId, state: game.toJSON() });
      }
      break;
    }
  }
});
