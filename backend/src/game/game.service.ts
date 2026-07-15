import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'worker_threads';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { GameDao } from '../dao/game-dao';
import { GameGateway } from './game.gateway';
import { Gamemode } from './gamemode.config';
import type { GamemodeConfig } from './gamemode.config';
import { AdminStatsService } from '../admin/admin-stats.service';

@Injectable()
export class GameService implements OnModuleDestroy {
  private worker!: Worker;
  private readonly logger = new Logger(GameService.name);

  constructor(
    private gameDao: GameDao,
    private gameGateway: GameGateway,
    private adminStats: AdminStatsService,
  ) {
    this.startWorker();
  }

  private startWorker() {
    this.worker = new Worker(join(__dirname, 'game.worker.js'));

    this.worker.on('message', (msg) => {
      switch (msg.type) {
        case 'gameStart': {
          this.gameDao.saveGame(msg.state);
          this.gameGateway.broadcastGameStart(msg);
          this.adminStats.recordGameStart(msg.gameId, msg.gamemode, msg.players, msg.state?.tickRateMs ?? 500);
          break;
        }
        case 'stateUpdate': {
          this.gameDao.saveGame(msg.state);
          const state = msg.state as any;
          state.tickCalcTime = msg.tickCalcTime;
          state.effects = msg.effects || [];
          this.gameGateway.broadcastStateUpdate(state);
          this.adminStats.recordTick(msg.gameId, msg.tickCalcTime);
          break;
        }
        case 'stateDiff': {
          const diff = msg.diff as any;
          diff.tickCalcTime = msg.tickCalcTime;
          diff.effects = msg.effects || [];
          this.gameGateway.broadcastStateDiff(msg.gameId, diff);
          this.adminStats.recordTick(msg.gameId, msg.tickCalcTime);
          break;
        }
        case 'gameEnd': {
          this.gameDao.saveGame(msg.state);
          this.gameGateway.broadcastGameEnd(msg);
          this.gameGateway.broadcastStateUpdate(msg.state);
          this.adminStats.recordGameEnd(msg.gameId, msg.state?.tick || 0, msg.winners || []);
          break;
        }
        case 'actionResult': {
          break;
        }
      }
    });

    this.worker.on('error', (err) => {
      this.logger.error(`worker error: ${err.message}`);
    });

    this.worker.on('exit', (code) => {
      this.logger.log(`worker exited code=${code}`);
      if (code !== 0) {
        this.logger.log('restarting worker...');
        this.startWorker();
      }
    });
  }

  launchGame(players: string[], gamemode: Gamemode, config: GamemodeConfig): string {
    const gameId = randomUUID();
    const { winCondition, ...configClone } = config;
    this.worker.postMessage({ type: 'init', gameId, players, gamemode, config: configClone });
    return gameId;
  }

  queueAction(
    gameId: string,
    playerId: string,
    body: { type: string; payload: unknown },
  ): { accepted: boolean; actionId?: string } {
    this.worker.postMessage({ type: 'action', gameId, playerId, body });
    return { accepted: true };
  }

  getGame(gameId: string): any {
    return this.gameDao.getGame(gameId);
  }

  onModuleDestroy() {
    this.worker.terminate();
  }
}