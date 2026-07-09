import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Gamemode } from '../game/gamemode.config';

@WebSocketGateway({ namespace: 'matchmaking', cors: { origin: '*' } })
export class MatchmakingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MatchmakingGateway.name);

  @WebSocketServer()
  server!: Server;

  private socketUser = new Map<string, string>();
  private userSockets = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId as string | undefined;
    this.logger.log(`connection client="${client.id}" userId="${userId}"`);
    if (userId) {
      this.socketUser.set(client.id, userId);
      const sockets = this.userSockets.get(userId) || new Set();
      sockets.add(client.id);
      this.userSockets.set(userId, sockets);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketUser.get(client.id);
    this.logger.log(`disconnect client="${client.id}" userId="${userId}"`);
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSockets.delete(userId);
      }
    }
    this.socketUser.delete(client.id);
  }

  private getSocketsForUsers(userIds: string[]): string[] {
    const ids: string[] = [];
    for (const uid of userIds) {
      const sockets = this.userSockets.get(uid);
      if (sockets) {
        ids.push(...sockets);
      } else {
        this.logger.warn(`no socket found for userId="${uid}"`);
      }
    }
    return ids;
  }

  emitCountdownTick(gamemode: Gamemode, seconds: number, playerIds: string[]) {
    const socketIds = this.getSocketsForUsers(playerIds);
    this.logger.log(`emitCountdownTick gamemode="${gamemode}" seconds=${seconds} players=[${playerIds}] sockets=[${socketIds}]`);
    for (const sid of socketIds) {
      this.server.to(sid).emit('countdownTick', { gamemode, seconds, playerIds });
    }
  }

  emitCountdownCancelled(gamemode: Gamemode, playerIds: string[]) {
    const socketIds = this.getSocketsForUsers(playerIds);
    this.logger.log(`emitCountdownCancelled gamemode="${gamemode}" players=[${playerIds}]`);
    for (const sid of socketIds) {
      this.server.to(sid).emit('countdownCancelled', { gamemode });
    }
  }

  emitGameFound(gamemode: Gamemode, gameId: string, playerIds: string[]) {
    const socketIds = this.getSocketsForUsers(playerIds);
    this.logger.log(`emitGameFound gamemode="${gamemode}" gameId="${gameId}" players=[${playerIds}] sockets=[${socketIds}]`);
    for (const sid of socketIds) {
      this.server.to(sid).emit('gameFound', { gamemode, gameId, players: playerIds });
    }
  }

  emitRequeued(gamemode: Gamemode, playerIds: string[]) {
    const socketIds = this.getSocketsForUsers(playerIds);
    this.logger.log(`emitRequeued gamemode="${gamemode}" players=[${playerIds}]`);
    for (const sid of socketIds) {
      this.server.to(sid).emit('requeued', { gamemode });
    }
  }
}
