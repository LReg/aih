import { Controller, Get, Req, ForbiddenException, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { AdminStatsService } from './admin-stats.service';
import { GameDao } from '../dao/game-dao';
import { LobbyService } from '../lobby/lobby.service';
import { QueueService } from '../queue/queue.service';
import { Role } from '../types/User';

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
  async getStats(@Req() req: Request) {
    const user = (req as any).user;
    if (user?.role !== Role.ADMIN) {
      this.logger.warn(`admin stats access denied for user="${user?.preferredUsername}"`);
      throw new ForbiddenException('Admin role required');
    }

    const allLobbies = this.lobbyService.getAllLobbies();
    const queueCounts = this.queueService.getQueueCounts();
    const runningGames = this.gameDao.getAllGames().filter((g: any) => g.state === 'running').length;

    return this.stats.getStats(allLobbies.length, queueCounts, runningGames);
  }
}
