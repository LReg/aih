import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthGuard } from './auth/auth.guard';
import { UserModule } from './user/user.module';
import { SocketModule } from './socket/socket.module';

@Module({
  imports: [DatabaseModule, UserModule, SocketModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
