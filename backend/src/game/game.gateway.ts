import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Game } from './game';

@WebSocketGateway({ namespace: 'game', cors: { origin: '*' } })
export class GameGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`Game client connected: ${client.id}`);
  }

  @SubscribeMessage('joinGame')
  handleJoinGame(client: Socket, gameId: string) {
    client.join(gameId);
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

  broadcastStateUpdate(game: Game) {
    this.server.to(game.id).emit('stateUpdate', game.toJSON());
  }
}
