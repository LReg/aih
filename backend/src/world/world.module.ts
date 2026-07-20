import { Module } from '@nestjs/common';
import { GameModule } from '../game/game.module';
import { WorldController } from './world.controller';
import { WorldService } from './world.service';

@Module({
  imports: [GameModule],
  controllers: [WorldController],
  providers: [WorldService],
})
export class WorldModule {}
