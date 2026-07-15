import { Controller, Post, Get, Patch, Delete, Param, Body, Req, Logger } from '@nestjs/common';
import { LobbyService } from './lobby.service';
import type { Request } from 'express';
import type { LobbySettings } from './lobby';

@Controller()
export class LobbyController {
  private readonly logger = new Logger(LobbyController.name);

  constructor(private lobbyService: LobbyService) {}

  @Post('lobby')
  create(@Body() body: { settings?: Partial<LobbySettings> }, @Req() req: Request) {
    const userId = req.user!.userId;
    const lobby = this.lobbyService.create(userId, body.settings);
    this.logger.log(`POST /lobby id=${lobby.id} user=${userId}`);
    return { lobbyId: lobby.id };
  }

  @Get('lobby/:id')
  get(@Param('id') id: string) {
    const lobby = this.lobbyService.get(id);
    return {
      id: lobby.id,
      hostId: lobby.hostId,
      players: lobby.players,
      settings: lobby.settings,
      createdAt: lobby.createdAt,
    };
  }

  @Post('lobby/:id/join')
  join(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user!.userId;
    this.lobbyService.join(id, userId);
    this.logger.log(`POST /lobby/${id}/join user=${userId}`);
    return { joined: true };
  }

  @Post('lobby/:id/leave')
  leave(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user!.userId;
    this.lobbyService.leave(id, userId);
    this.logger.log(`POST /lobby/${id}/leave user=${userId}`);
    return { left: true };
  }

  @Post('lobby/:id/start')
  start(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user!.userId;
    const gameId = this.lobbyService.start(id, userId);
    this.logger.log(`POST /lobby/${id}/start user=${userId} gameId=${gameId}`);
    return { gameId };
  }

  @Delete('lobby/:id')
  cancel(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user!.userId;
    this.lobbyService.cancel(id, userId);
    this.logger.log(`DELETE /lobby/${id} user=${userId}`);
    return { cancelled: true };
  }

  @Patch('lobby/:id/settings')
  updateSettings(@Param('id') id: string, @Body() body: Partial<LobbySettings>, @Req() req: Request) {
    const userId = req.user!.userId;
    this.lobbyService.updateSettings(id, userId, body);
    this.logger.log(`PATCH /lobby/${id}/settings user=${userId}`);
    return { updated: true };
  }
}
