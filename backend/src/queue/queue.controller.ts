import { Controller, Post, Body, Req } from '@nestjs/common';
import { QueueService } from './queue.service';
import { Gamemode } from '../game/gamemode.config';
import type { Request } from 'express';

@Controller()
export class QueueController {
  constructor(private queueService: QueueService) {}

  @Post('queue/join')
  join(@Body() body: { gamemode: Gamemode }, @Req() req: Request) {
    this.queueService.join(body.gamemode, req.user.preferredUsername);
    return { queued: true };
  }

  @Post('queue/leave')
  leave(@Body() body: { gamemode: Gamemode }, @Req() req: Request) {
    this.queueService.leave(body.gamemode, req.user.preferredUsername);
    return { left: true };
  }
}
