import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { LldapService } from './lldap.service';

@Module({
  controllers: [AuthController],
  providers: [LldapService],
  exports: [LldapService],
})
export class AuthModule {}
