import { Controller, Get, Post, Req } from '@nestjs/common';
import { WorldService } from './world.service';
import type { Request } from 'express';

@Controller('world')
export class WorldController {
  constructor(private worldService: WorldService) {}

  @Post('join')
  joinWorld(@Req() req: Request): { gameId: string } {
    const user = (req as any).user;
    if (!user?.userId) throw new Error('Not authenticated');
    return this.worldService.joinWorld(user.userId, user.preferredUsername);
  }

  @Get('status')
  getStatus(): { activePlayers: number; maxPlayers: number } {
    return this.worldService.getStatus();
  }
}
