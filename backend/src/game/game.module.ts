import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { GameDao } from '../dao/game-dao';

@Module({
  controllers: [GameController],
  providers: [GameService, GameGateway, GameDao],
  exports: [GameService],
})
export class GameModule {}
