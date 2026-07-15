import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { getUsersByIds } from '../dao/UserDao';

interface TickDoc {
  _id?: string;
  gameId: string;
  sum: number;
  count: number;
  min: number;
  max: number;
}

interface CountersDoc {
  _id?: string;
  totalGamesCreated: number;
  finishedGames: number;
  lobbiesCreated: number;
}

interface LifecycleDoc {
  _id?: string;
  gameId: string;
  gamemode: string;
  startedAt: Date;
  endedAt?: Date;
  finalTick?: number;
  players: string[];
  winners: string[];
  tickRateMs: number;
}

@Injectable()
export class AdminStatsService {
  private readonly logger = new Logger(AdminStatsService.name);
  private initialized = false;

  constructor(private db: DatabaseService) {}

  private async init() {
    if (this.initialized) return;
    if (!this.db.db) return;
    this.initialized = true;
    await this.db.db.collection<CountersDoc>('admin_stats').updateOne(
      { _id: 'counters' },
      { $setOnInsert: { totalGamesCreated: 0, finishedGames: 0, lobbiesCreated: 0 } },
      { upsert: true },
    );
  }

  private async exec<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (err: any) {
      this.logger.error(`${label}: ${err?.message || err}`);
      return undefined;
    }
  }

  async recordGameStart(gameId: string, gamemode: string, players: string[], tickRateMs: number) {
    await this.init();
    if (!this.initialized) return;
    await this.exec('recordGameStart', () => Promise.all([
      this.db.db.collection<CountersDoc>('admin_stats').updateOne({ _id: 'counters' }, { $inc: { totalGamesCreated: 1 } }),
      this.db.db.collection<LifecycleDoc>('admin_game_lifecycle').insertOne({ gameId, gamemode, startedAt: new Date(), players, winners: [], tickRateMs }),
    ]));
    this.logger.log(`game start: ${gameId} (${gamemode})`);
  }

  async recordGameEnd(gameId: string, finalTick: number, winners: string[]) {
    await this.init();
    if (!this.initialized) return;
    await this.exec('recordGameEnd', () => Promise.all([
      this.db.db.collection<CountersDoc>('admin_stats').updateOne({ _id: 'counters' }, { $inc: { finishedGames: 1 } }),
      this.db.db.collection<LifecycleDoc>('admin_game_lifecycle').updateOne({ gameId }, { $set: { endedAt: new Date(), finalTick, winners } }),
    ]));
    this.logger.log(`game end: ${gameId} tick=${finalTick}`);
  }

  async recordTick(gameId: string, tickCalcTime: number) {
    await this.init();
    if (!this.initialized) return;
    await this.exec('recordTick', () =>
      this.db.db.collection<TickDoc>('admin_tick_stats').updateOne(
        { gameId },
        {
          $inc: { sum: tickCalcTime, count: 1 },
          $min: { min: tickCalcTime },
          $max: { max: tickCalcTime },
          $setOnInsert: { gameId },
        },
        { upsert: true },
      ),
    );
  }

  async recordLobbyCreated() {
    await this.init();
    if (!this.initialized) return;
    await this.exec('recordLobbyCreated', () =>
      this.db.db.collection<CountersDoc>('admin_stats').updateOne({ _id: 'counters' }, { $inc: { lobbiesCreated: 1 } }),
    );
  }

  private async getCounters(): Promise<{ totalGamesCreated: number; finishedGames: number; lobbiesCreated: number }> {
    try {
      const doc = await this.db.db.collection<CountersDoc>('admin_stats').findOne({ _id: 'counters' });
      return {
        totalGamesCreated: doc?.totalGamesCreated ?? 0,
        finishedGames: doc?.finishedGames ?? 0,
        lobbiesCreated: doc?.lobbiesCreated ?? 0,
      };
    } catch {
      return { totalGamesCreated: 0, finishedGames: 0, lobbiesCreated: 0 };
    }
  }

  private async getRunningCount(): Promise<number> {
    try {
      return await this.db.db.collection<LifecycleDoc>('admin_game_lifecycle').countDocuments({ endedAt: { $exists: false } });
    } catch {
      return 0;
    }
  }

  private calcUtil(avg: number, tickRateMs: number): number {
    return Math.max(0, Math.round(((tickRateMs + avg) / tickRateMs) * 100));
  }

  async getStats(lobbyCount: number, queueCounts: Record<string, number>, runningGames: number) {
    let allTickDocs: any[] = [];
    let lifecycleDocs: LifecycleDoc[] = [];
    try {
      [allTickDocs, lifecycleDocs] = await Promise.all([
        this.db.db.collection<TickDoc>('admin_tick_stats').find().toArray(),
        this.db.db.collection<LifecycleDoc>('admin_game_lifecycle').find().sort({ startedAt: -1 }).toArray(),
      ]);
    } catch {}
    const counters = await this.getCounters();

    const lifecycleByGameId = new Map(lifecycleDocs.map(d => [d.gameId, d]));

    const byGame: Record<string, { avg: number; min: number; max: number; count: number; avgUtil: number; minUtil: number; maxUtil: number; tickRateMs: number }> = {};
    let overallSum = 0;
    let overallCount = 0;
    let overallMin = Infinity;
    let overallMax = -Infinity;
    let overallSumUtil = 0;
    let overallCountUtil = 0;
    let overallMinUtil = Infinity;
    let overallMaxUtil = -Infinity;
    const lagging: string[] = [];
    const healthy: string[] = [];

    for (const doc of allTickDocs) {
      const avg = Math.round(doc.sum / doc.count);
      const lifecycle = lifecycleByGameId.get(doc.gameId);
      const tickRateMs = lifecycle?.tickRateMs ?? 500;
      const avgUtil = this.calcUtil(avg, tickRateMs);
      const minUtil = this.calcUtil(doc.min, tickRateMs);
      const maxUtil = this.calcUtil(doc.max, tickRateMs);
      byGame[doc.gameId] = { avg, min: doc.min, max: doc.max, count: doc.count, avgUtil, minUtil, maxUtil, tickRateMs };
      overallSum += doc.sum;
      overallCount += doc.count;
      if (doc.min < overallMin) overallMin = doc.min;
      if (doc.max > overallMax) overallMax = doc.max;
      overallSumUtil += avgUtil;
      overallCountUtil++;
      if (avgUtil < overallMinUtil) overallMinUtil = avgUtil;
      if (avgUtil > overallMaxUtil) overallMaxUtil = avgUtil;
      if (avgUtil > 100) lagging.push(doc.gameId);
      else healthy.push(doc.gameId);
    }

    const allUserIds = [...new Set(lifecycleDocs.flatMap(d => [...d.players, ...d.winners]))];
    let userNames: Record<string, string> = {};
    try {
      const users = await getUsersByIds(this.db.db, allUserIds);
      for (const u of users) { if (u.userId) userNames[u.userId] = u.preferredUsername || u.userId; }
    } catch { /* use IDs as fallback */ }

    return {
      games: {
        totalCreated: counters.totalGamesCreated,
        running: runningGames,
        finished: counters.finishedGames,
        details: lifecycleDocs.map(d => ({
          gameId: d.gameId,
          gamemode: d.gamemode,
          startedAt: d.startedAt,
          endedAt: d.endedAt ?? null,
          finalTick: d.finalTick ?? null,
          players: d.players,
          winners: d.winners,
          playerNames: userNames,
          tickRateMs: d.tickRateMs,
        })),
      },
      lobbies: {
        active: lobbyCount,
        totalCreated: counters.lobbiesCreated,
      },
      queues: queueCounts,
      tickDiff: {
        byGame,
        overall: overallCount > 0
          ? {
              avg: Math.round(overallSum / overallCount),
              min: overallMin,
              max: overallMax,
              count: overallCount,
              avgUtil: overallCountUtil > 0 ? Math.round(overallSumUtil / overallCountUtil) : 0,
              minUtil: overallMinUtil === Infinity ? 0 : overallMinUtil,
              maxUtil: overallMaxUtil === -Infinity ? 0 : overallMaxUtil,
            }
          : null,
      },
      health: {
        lagging,
        healthy,
        totalWithTickData: allTickDocs.length,
      },
    };
  }

  async reset() {
    await Promise.all([
      this.db.db.collection<CountersDoc>('admin_stats').deleteOne({ _id: 'counters' }),
      this.db.db.collection<LifecycleDoc>('admin_game_lifecycle').deleteMany({}),
      this.db.db.collection<TickDoc>('admin_tick_stats').deleteMany({}),
    ]);
    this.initialized = false;
    this.logger.log('stats reset');
  }
}
