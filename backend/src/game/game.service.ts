import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'worker_threads';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { GameDao } from '../dao/game-dao';
import { GameGateway } from './game.gateway';
import { Gamemode } from './gamemode.config';
import type { GamemodeConfig } from './gamemode.config';
import { AdminStatsService } from '../admin/admin-stats.service';
import { DatabaseService } from '../database/database.service';
import { EloCalculator } from './elo-calculator.service';
import { getProfile, upsertProfile } from '../dao/PlayerProfileDao';
import { saveMatchRecord } from '../dao/MatchHistoryDao';
import { getUserById, getUsersByIds } from '../dao/UserDao';

@Injectable()
export class GameService implements OnModuleDestroy {
  private worker!: Worker;
  private readonly logger = new Logger(GameService.name);

  constructor(
    private gameDao: GameDao,
    private gameGateway: GameGateway,
    private adminStats: AdminStatsService,
    private db: DatabaseService,
    private eloCalculator: EloCalculator,
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
          this.handleGameEndElo(msg).catch(err => this.logger.error(`elo error: ${err.message}`));
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
    this.loadPlayerNames(players).then(names => {
      this.worker.postMessage({ type: 'init', gameId, players, gamemode, config: configClone, playerNames: names });
    }).catch(() => {
      this.worker.postMessage({ type: 'init', gameId, players, gamemode, config: configClone });
    });
    return gameId;
  }

  private async loadPlayerNames(players: string[]): Promise<Record<string, string>> {
    const names: Record<string, string> = {};
    if (!this.db.db) return names;
    const users = await getUsersByIds(this.db.db, players);
    for (const u of users) {
      if (u.userId) names[u.userId] = u.preferredUsername || u.userId;
    }
    return names;
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

  getActiveGame(userId: string): string | null {
    const games = this.gameDao.getAllGames();
    for (const game of games) {
      if (game.players?.includes(userId) && game.state !== 'finished') return game.gameId || game.id;
    }
    return null;
  }

  private async handleGameEndElo(msg: any) {
    const placementOrder: string[] = msg.eliminationOrder || [];
    const playerNames: Record<string, string> = msg.state?.playerNames || msg.playerNames || {};
    if (placementOrder.length < 2 || !this.db.db) {
      this.gameGateway.broadcastElos(msg.gameId, {}, [], false, placementOrder, playerNames);
      return;
    }

    const allPlayers: { userId: string; username: string; email?: string }[] = [];
    for (const userId of placementOrder) {
      const user = await getUserById(this.db.db, userId);
      allPlayers.push({ userId: user?.userId || userId, username: user?.preferredUsername || playerNames[userId] || userId, email: user?.email });
    }

    const eloTracked = allPlayers.filter(p => !p.email?.endsWith('@local'));

    if (eloTracked.length >= 2) {
      const eloData: { username: string; elo: number }[] = [];
      for (const e of eloTracked) {
        const profile = await getProfile(this.db.db, e.userId);
        eloData.push({ username: e.userId, elo: profile?.elo ?? 1000 });
      }
      const filteredPlacements = placementOrder.filter(uid => eloTracked.some(e => e.userId === uid));
      const eloResultsInput = filteredPlacements.map(uid => eloTracked.find(e => e.userId === uid)!.userId);
      const results = this.eloCalculator.calculate(eloData, eloResultsInput);

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const userId = filteredPlacements[i];
        const entry = eloTracked.find(e => e.userId === userId)!;
        const profile = await getProfile(this.db.db, entry.userId);
        if (!profile && r.eloDelta === 0) continue;
        const gamesPlayed = (profile?.gamesPlayed ?? 0) + 1;
        const wins = (profile?.wins ?? 0) + (r.eloDelta > 0 ? 1 : 0);
        await upsertProfile(this.db.db, entry.userId, entry.username, {
          elo: r.eloAfter,
          gamesPlayed,
          wins,
        });
        await saveMatchRecord(this.db.db, {
          userId: entry.userId,
          username: entry.username,
          gameId: msg.gameId,
          gamemode: msg.state?.gamemode || 'unknown',
          placement: placementOrder.length - placementOrder.indexOf(userId),
          totalPlayers: placementOrder.length,
          eloDelta: r.eloDelta,
          eloBefore: r.eloBefore,
          eloAfter: r.eloAfter,
          timestamp: new Date(),
        });
      }

      const elos: Record<string, number> = {};
      const eloResults: { userId: string; eloDelta: number; placement: number; username: string }[] = [];
      for (let i = 0; i < results.length; i++) {
        const userId = filteredPlacements[i];
        elos[userId] = results[i].eloAfter;
        eloResults.push({
          userId,
          eloDelta: results[i].eloDelta,
          placement: placementOrder.length - placementOrder.indexOf(userId),
          username: eloTracked.find(e => e.userId === userId)?.username || userId,
        });
      }
      this.gameGateway.broadcastElos(msg.gameId, elos, eloResults, true, placementOrder, playerNames);
    } else {
      this.gameGateway.broadcastElos(msg.gameId, {}, [], false, placementOrder, playerNames);
    }

    for (const p of allPlayers) {
      if (eloTracked.some(e => e.userId === p.userId)) continue;
      await saveMatchRecord(this.db.db, {
        userId: p.userId,
        username: p.username,
        gameId: msg.gameId,
        gamemode: msg.state?.gamemode || 'unknown',
        placement: placementOrder.length - placementOrder.indexOf(p.userId),
        totalPlayers: placementOrder.length,
        eloDelta: 0,
        eloBefore: 0,
        eloAfter: 0,
        timestamp: new Date(),
      });
    }
  }

  async checkEloGame(gameId: string): Promise<{ eloGame: boolean }> {
    const game = this.gameDao.getGame(gameId);
    if (!game || !game.players || !this.db.db) return { eloGame: false };
    const users = await getUsersByIds(this.db.db, game.players);
    const eloCount = users.filter(u => u.userId && !u.localAuth).length;
    return { eloGame: eloCount >= 2 };
  }

  onModuleDestroy() {
    this.worker.terminate();
  }
}