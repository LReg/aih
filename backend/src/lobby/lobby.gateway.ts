import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Lobby } from './lobby';

@WebSocketGateway({ namespace: 'lobby', cors: { origin: '*' } })
export class LobbyGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`Lobby client connected: ${client.id}`);
  }

  @SubscribeMessage('joinLobby')
  handleJoinLobby(client: Socket, lobbyId: string) {
    client.join(lobbyId);
  }

  @SubscribeMessage('leaveLobby')
  handleLeaveLobby(client: Socket, lobbyId: string) {
    client.leave(lobbyId);
  }

  broadcastLobbyUpdate(lobby: Lobby) {
    this.server.to(lobby.id).emit('lobbyUpdate', {
      id: lobby.id,
      hostId: lobby.hostId,
      players: lobby.players,
      settings: lobby.settings,
      createdAt: lobby.createdAt,
    });
  }

  broadcastLobbyStarted(lobby: Lobby, gameId: string) {
    this.server.to(lobby.id).emit('lobbyStarted', {
      gameId,
      players: lobby.players,
      gamemode: lobby.settings.gamemode,
    });
  }

  broadcastLobbyCancelled(lobby: Lobby) {
    this.server.to(lobby.id).emit('lobbyCancelled', {
      lobbyId: lobby.id,
    });
  }
}
