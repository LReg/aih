import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Lobby } from './lobby';
import { LobbyService } from './lobby.service';

@WebSocketGateway({ namespace: 'lobby', cors: { origin: '*' } })
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private socketMap = new Map<string, { userId: string; lobbyId: string }>();

  constructor(
    @Inject(forwardRef(() => LobbyService))
    private lobbyService: LobbyService,
  ) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId as string | undefined;
    if (userId) this.socketMap.set(client.id, { userId, lobbyId: '' });
  }

  handleDisconnect(client: Socket) {
    const entry = this.socketMap.get(client.id);
    if (entry?.lobbyId && entry?.userId) {
      try { this.lobbyService.leave(entry.lobbyId, entry.userId); } catch {}
    }
    this.socketMap.delete(client.id);
  }

  @SubscribeMessage('joinLobby')
  handleJoinLobby(client: Socket, lobbyId: string) {
    client.join(lobbyId);
    const entry = this.socketMap.get(client.id);
    if (entry) entry.lobbyId = lobbyId;
  }

  @SubscribeMessage('leaveLobby')
  handleLeaveLobby(client: Socket, lobbyId: string) {
    client.leave(lobbyId);
    const entry = this.socketMap.get(client.id);
    if (entry?.lobbyId === lobbyId) entry.lobbyId = '';
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
