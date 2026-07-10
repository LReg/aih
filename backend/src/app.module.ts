import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { SocketModule } from './socket/socket.module';
import { GameModule } from './game/game.module';
import { QueueModule } from './queue/queue.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';

@Module({
  imports: [DatabaseModule, AuthModule, UserModule, SocketModule, GameModule, QueueModule, MatchmakingModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
