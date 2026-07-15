import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { GameDao } from '../dao/game-dao';
import { AdminStatsService } from '../admin/admin-stats.service';
import { EloCalculator } from './elo-calculator.service';

@Module({
  controllers: [GameController],
  providers: [GameService, GameGateway, GameDao, AdminStatsService, EloCalculator],
  exports: [GameService, AdminStatsService, GameDao, EloCalculator],
})
export class GameModule {}
