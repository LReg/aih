import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { GameModule } from '../game/game.module';
import { LobbyModule } from '../lobby/lobby.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [GameModule, LobbyModule, QueueModule],
  controllers: [AdminController],
})
export class AdminModule {}
