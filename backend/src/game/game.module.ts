import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { GameDao } from '../dao/game-dao';
import { AdminStatsService } from '../admin/admin-stats.service';

@Module({
  controllers: [GameController],
  providers: [GameService, GameGateway, GameDao, AdminStatsService],
  exports: [GameService, AdminStatsService, GameDao],
})
export class GameModule {}
