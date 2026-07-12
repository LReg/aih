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
  for (let r = 0; r <= 3 && placed < count; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        if (placed >= count) return placed;
        const x = cx + dx;
        const y = cy + dy;
        if (game.map.isInBounds(x, y) && game.map.isTileEmpty(x, y)) {
          const soldier = createSoldier(ownerId, x, y);
          game.map.addEntity(soldier);
          placed++;
        }
      }
    }
  }
  return placed;
}

function generateSpawnPositions(map: GameMap, count: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const margin = 2;
  const regionW = Math.floor((map.width - margin * 2) / Math.max(count, 1));
  const midH = Math.floor(map.height / 2);

  for (let i = 0; i < count; i++) {
    const cx = margin + regionW * i + Math.floor(regionW / 2);
    for (let dy = -2; dy <= 2; dy++) {
      const x = cx;
      const y = midH + dy;
      if (map.isInBounds(x, y) && map.isTileEmpty(x, y)) {
        positions.push({ x, y });
        break;
      }
    }
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

  game.tick++;
  const actions = game.actionQueue.splice(0, game.actionQueue.length);
  processActions(game, actions);
  processGame(game);

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

  if (game.tick === 1 || game.tick % 10 === 0) {
    parentPort?.postMessage({ type: 'stateUpdate', gameId: game.id, state: game.toJSON() });
  } else {
    parentPort?.postMessage({ type: 'stateDiff', gameId: game.id, diff: game.toDiffJSON() });
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
