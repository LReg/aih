import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Game } from './game';
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
    const game = this.gameDao.getGame(gameId);
    if (game) {
      client.emit('stateUpdate', game.toJSON());
    }
  }

  @SubscribeMessage('leaveGame')
  handleLeaveGame(client: Socket, gameId: string) {
    client.leave(gameId);
  }

  broadcastGameStart(game: Game) {
    this.server.emit('gameFound', {
      gameId: game.id,
      players: game.players,
      gamemode: game.gamemode,
    });
  }

  broadcastGameEnd(game: Game) {
    this.server.to(game.id).emit('gameEnded', {
      gameId: game.id,
      winners: game.winners,
    });
  }

  broadcastStateUpdate(game: Game) {
    this.server.to(game.id).emit('stateUpdate', game.toJSON());
  }

  broadcastStateDiff(game: Game) {
    const diff = game.toDiffJSON();
    this.server.to(game.id).emit('stateUpdate', diff);
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
