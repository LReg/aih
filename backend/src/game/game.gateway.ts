import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameDao } from '../dao/game-dao';

@WebSocketGateway({ namespace: 'game', cors: { origin: '*' } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private socketUserMap = new Map<string, string>();

  constructor(private gameDao: GameDao) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId as string | undefined;
    if (userId) this.socketUserMap.set(client.id, userId);
  }

  handleDisconnect(client: Socket) {
    this.socketUserMap.delete(client.id);
  }

  @SubscribeMessage('joinGame')
  handleJoinGame(client: Socket, gameId: string) {
    client.join(gameId);
    const state = this.gameDao.getGame(gameId);
    if (state) {
      client.emit('stateUpdate', state);
    }
  }

  @SubscribeMessage('leaveGame')
  handleLeaveGame(client: Socket, gameId: string) {
    client.leave(gameId);
  }

  broadcastGameStart(state: { gameId: string; players: string[]; gamemode: string }) {
    this.server.emit('gameFound', {
      gameId: state.gameId,
      players: state.players,
      gamemode: state.gamemode,
    });
  }

  broadcastGameEnd(state: { gameId: string; winners: string[] }) {
    this.server.to(state.gameId).emit('gameEnded', {
      gameId: state.gameId,
      winners: state.winners,
    });
  }

  broadcastStateUpdate(state: any) {
    this.server.to(state.id || state.gameId).emit('stateUpdate', state);
  }

  broadcastElos(gameId: string, elos: Record<string, number>, eloResults: { userId: string; eloDelta: number; placement: number; username: string }[], eloGame: boolean, placementOrder: string[], playerNames: Record<string, string>) {
    this.server.to(gameId).emit('elos', { elos, results: eloResults, eloGame, placementOrder, playerNames });
  }

  broadcastStateDiff(gameId: string, diff: any) {
    this.server.to(gameId).emit('stateUpdate', diff);
  }

  disconnectGameRoom(gameId: string) {
    this.server.to(gameId).emit('gameTerminated', { gameId });
    const room = this.server.sockets.adapter.rooms.get(gameId);
    if (!room) return;
    for (const socketId of room) {
      const sock = this.server.sockets.sockets.get(socketId);
      sock?.leave(gameId);
    }
  }
}
