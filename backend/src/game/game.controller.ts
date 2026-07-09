import { Controller, Post, Get, Param, Body, Req, Logger } from '@nestjs/common';
import { GameService } from './game.service';
import type { Request } from 'express';

@Controller()
export class GameController {
  private readonly logger = new Logger(GameController.name);

  constructor(private gameService: GameService) {}

  @Post('game/:gameId/action')
  submitAction(
    @Param('gameId') gameId: string,
    @Body() body: { type: string; payload: unknown },
    @Req() req: Request,
  ) {
    const playerId = req.user?.preferredUsername || 'unknown';
    this.logger.log(`action: user=${playerId} game=${gameId} type=${body.type}`);
    const result = this.gameService.queueAction(gameId, playerId, body);
    this.logger.log(`action result: accepted=${result.accepted}${result.actionId ? ' id=' + result.actionId : ''}`);
    return result;
  }

  @Get('game/:gameId')
  getGame(@Param('gameId') gameId: string) {
    return this.gameService.getGame(gameId)?.toJSON();
  }
}
