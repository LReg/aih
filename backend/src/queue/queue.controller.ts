import { Controller, Post, Body, Req, Logger } from '@nestjs/common';
import { QueueService } from './queue.service';
import { Gamemode } from '../game/gamemode.config';
import type { Request } from 'express';

@Controller()
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(private queueService: QueueService) {}

  @Post('queue/join')
  join(@Body() body: { gamemode: Gamemode }, @Req() req: Request) {
    this.logger.log(`POST /queue/join gamemode="${body.gamemode}" user="${req.user?.preferredUsername}" role="${req.user?.role}" localAuth="${req.user?.localAuth}"`);
    this.queueService.join(body.gamemode, req.user.preferredUsername);
    return { queued: true };
  }

  @Post('queue/leave')
  leave(@Body() body: { gamemode: Gamemode }, @Req() req: Request) {
    this.logger.log(`POST /queue/leave gamemode="${body.gamemode}" user="${req.user?.preferredUsername}"`);
    this.queueService.leave(body.gamemode, req.user.preferredUsername);
    return { left: true };
  }
}
