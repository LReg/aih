import { Injectable, Logger } from '@nestjs/common';
import { GameDao } from '../dao/game-dao';
import { GameGateway } from './game.gateway';
import { GameMap, createSoldier } from './game-map';
import { Game } from './game';
import { Gamemode, GAMEMODE_CONFIGS } from './gamemode.config';
import type { GamemodeConfig } from './gamemode.config';
import { processActions, queueGameAction } from './actions/actions';
import { processGame } from './processing/processing';

const CLEANUP_DELAY_MS = 300_000;

@Injectable()
export class GameService {
  private ticks = new Map<string, NodeJS.Timeout>();
  private readonly logger = new Logger(GameService.name);

  constructor(
    private gameDao: GameDao,
    private gameGateway: GameGateway,
  ) {}

  launchGame(players: string[], gamemode: Gamemode, config: GamemodeConfig): string {
    const game = new Game(gamemode, new GameMap(config.mapWidth, config.mapHeight), players);
    this.spawnPlayers(game, players);
    game.state = 'running';
    game.tick = 0;
    game.startedAt = Date.now();
    game.peaceUntil = Date.now() + config.peaceDurationMs;
    game.tickRateMs = config.tickRateMs;
    this.gameDao.saveGame(game);
    this.gameGateway.broadcastGameStart(game);
    this.startTick(game, config.tickRateMs);
    this.logger.log(`launched game=${game.id} players=${players.length} gamemode=${gamemode}`);
    return game.id;
  }

  private spawnPlayers(game: Game, players: string[]) {
    const positions = this.generateSpawnPositions(game.map, players.length);
    for (let i = 0; i < players.length; i++) {
      const pos = positions[i];
      const soldier = createSoldier(players[i], pos.x, pos.y);
      game.map.addEntity(soldier);
      this.logger.log(`spawned player=${players[i]} at (${pos.x},${pos.y})`);
    }
  }

  private generateSpawnPositions(map: GameMap, count: number): { x: number; y: number }[] {
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

  queueAction(
    gameId: string,
    playerId: string,
    body: { type: string; payload: unknown },
  ): { accepted: boolean; actionId?: string } {
    const game = this.gameDao.getGame(gameId);
    if (!game) return { accepted: false };
    return queueGameAction(game, playerId, body);
  }

  getGame(gameId: string): Game | undefined {
    return this.gameDao.getGame(gameId);
  }

  private startTick(game: Game, rateMs: number) {
    const interval = setInterval(() => this.tick(game.id), rateMs);
    this.ticks.set(game.id, interval);
    this.logger.log(`tick started game=${game.id} rate=${rateMs}ms`);
  }

  private stopTick(gameId: string) {
    const interval = this.ticks.get(gameId);
    if (!interval) return;
    clearInterval(interval);
    this.ticks.delete(gameId);
    this.logger.log(`tick stopped game=${gameId}`);
  }

  private tick(gameId: string) {
    const game = this.gameDao.getGame(gameId);
    if (!game || game.state !== 'running') return;

    game.tick++;
    const actions = game.actionQueue.splice(0, game.actionQueue.length);
    if (actions.length > 0) {
      this.logger.log(`tick=${game.tick} processing ${actions.length} actions`);
    }
    processActions(game, actions);
    processGame(game);

    const config = GAMEMODE_CONFIGS[game.gamemode];
    let winners: string[] = [];

    if (game.tick > 10) {
      winners = config.winCondition(game);
    }

    if (winners.length > 0) {
      this.logger.log(`game finished game=${game.id} winners=${winners.join(',')}`);
      game.winners = winners;
      game.state = 'finished';
      this.stopTick(game.id);
      this.gameGateway.broadcastGameEnd(game);
      this.gameGateway.broadcastStateUpdate(game);
      setTimeout(() => {
        this.gameDao.removeGame(game.id);
        game.destroy();
      }, CLEANUP_DELAY_MS);
      return;
    }

    this.gameGateway.broadcastStateUpdate(game);
  }

}