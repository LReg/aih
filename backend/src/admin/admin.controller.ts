import { Controller, Get, Query, UnauthorizedException, Logger } from '@nestjs/common';
import { AdminStatsService } from './admin-stats.service';
import { GameDao } from '../dao/game-dao';
import { LobbyService } from '../lobby/lobby.service';
import { QueueService } from '../queue/queue.service';

const ADMIN_PASSWORD = 'strad-admin-view';

@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private stats: AdminStatsService,
    private gameDao: GameDao,
    private lobbyService: LobbyService,
    private queueService: QueueService,
  ) {}

  @Get('stats')
  async getStats(@Query('password') password: string) {
    if (password !== ADMIN_PASSWORD) {
      this.logger.warn('failed admin auth attempt');
      throw new UnauthorizedException('invalid password');
    }

    const allLobbies = this.lobbyService.getAllLobbies();
    const queueCounts = this.queueService.getQueueCounts();

    return this.stats.getStats(allLobbies.length, queueCounts);
  }
}
