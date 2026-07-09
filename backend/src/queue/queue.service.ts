import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { QueueDao } from './queue-dao';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { Gamemode, GAMEMODE_CONFIGS } from '../game/gamemode.config';

@Injectable()
export class QueueService {
  constructor(
    private queueDao: QueueDao,
    @Inject(forwardRef(() => MatchmakingService))
    private matchmaking: MatchmakingService,
  ) {}

  join(gamemode: Gamemode, userId: string) {
    const config = GAMEMODE_CONFIGS[gamemode];
    if (!config) throw new BadRequestException('Unknown gamemode');

    const active = this.matchmaking.getActiveMatch(gamemode);
    if (active) {
      const added = this.matchmaking.addPlayer(active.id, userId);
      if (added) return;
    }

    this.queueDao.add(gamemode, userId);

    if (!config.startMinPlayers) return;
    const queue = this.queueDao.getQueue(gamemode);
    if (queue.length >= config.startMinPlayers) {
      const players = queue.splice(0, config.maxPlayers);
      this.matchmaking.createMatch(gamemode, players);
    }
  }

  leave(gamemode: Gamemode, userId: string) {
    const active = this.matchmaking.getActiveMatch(gamemode);
    if (active && active.players.includes(userId)) {
      const { requeued } = this.matchmaking.removePlayer(active.id, userId);
      for (const pid of requeued) {
        this.queueDao.add(gamemode, pid);
      }
      this.checkForNewMatch(gamemode);
      return;
    }

    this.queueDao.remove(gamemode, userId);
  }

  checkForNewMatch(gamemode: Gamemode) {
    const config = GAMEMODE_CONFIGS[gamemode];
    if (!config?.startMinPlayers) return;

    const queue = this.queueDao.getQueue(gamemode);
    if (queue.length >= config.startMinPlayers) {
      const players = queue.splice(0, config.maxPlayers);
      this.matchmaking.createMatch(gamemode, players);
    }
  }
}
