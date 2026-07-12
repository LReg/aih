import { Injectable, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { QueueDao } from './queue-dao';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { Gamemode, GAMEMODE_CONFIGS } from '../game/gamemode.config';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private queueDao: QueueDao,
    @Inject(forwardRef(() => MatchmakingService))
    private matchmaking: MatchmakingService,
  ) {}

  join(gamemode: Gamemode, userId: string) {
    const config = GAMEMODE_CONFIGS[gamemode];
    if (!config) throw new BadRequestException('Unknown gamemode');

    this.logger.log(`join gamemode="${gamemode}" userId="${userId}"`);
    const active = this.matchmaking.getActiveMatch(gamemode);
    if (active) {
      this.logger.log(`active match found id="${active.id}" players=[${active.players}]`);
      const added = this.matchmaking.addPlayer(active.id, userId);
      this.logger.log(`addPlayer result="${added}"`);
      if (added) return;
    }

    this.queueDao.add(gamemode, userId);
    this.matchmaking.broadcastQueueUpdate(this.getQueueCounts());

    if (!config.startMinPlayers) {
      this.logger.log(`no startMinPlayers for gamemode="${gamemode}"`);
      return;
    }
    const queue = this.queueDao.getQueue(gamemode);
    this.logger.log(`queue length=${queue.length} startMinPlayers=${config.startMinPlayers}`);
    if (queue.length >= config.startMinPlayers) {
      const players = queue.splice(0, config.maxPlayers);
      this.logger.log(`creating match gamemode="${gamemode}" players=[${players}]`);
      this.matchmaking.createMatch(gamemode, players);
    }
  }

  leave(gamemode: Gamemode, userId: string) {
    this.logger.log(`leave gamemode="${gamemode}" userId="${userId}"`);
    const active = this.matchmaking.getActiveMatch(gamemode);
    if (active && active.players.includes(userId)) {
      this.logger.log(`removing from active match id="${active.id}"`);
      const { requeued } = this.matchmaking.removePlayer(active.id, userId);
      for (const pid of requeued) {
        this.queueDao.add(gamemode, pid);
      }
      this.matchmaking.broadcastQueueUpdate(this.getQueueCounts());
      this.checkForNewMatch(gamemode);
      return;
    }

    this.queueDao.remove(gamemode, userId);
    this.matchmaking.broadcastQueueUpdate(this.getQueueCounts());
  }

  getQueueCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const gamemode of Object.values(Gamemode)) {
      counts[gamemode] = this.queueDao.getQueue(gamemode).length;
    }
    return counts;
  }

  checkForNewMatch(gamemode: Gamemode) {
    this.logger.log(`checkForNewMatch gamemode="${gamemode}"`);
    const config = GAMEMODE_CONFIGS[gamemode];
    if (!config?.startMinPlayers) return;

    const queue = this.queueDao.getQueue(gamemode);
    if (queue.length >= config.startMinPlayers) {
      const players = queue.splice(0, config.maxPlayers);
      this.logger.log(`creating new match from requeued players=[${players}]`);
      this.matchmaking.createMatch(gamemode, players);
    }
    this.matchmaking.broadcastQueueUpdate(this.getQueueCounts());
  }
}
