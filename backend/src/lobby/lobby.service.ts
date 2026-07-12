import { Inject, Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, forwardRef } from '@nestjs/common';
import { Lobby } from './lobby';
import { LobbyGateway } from './lobby.gateway';
import { GameService } from '../game/game.service';
import { GAMEMODE_CONFIGS } from '../game/gamemode.config';
import type { LobbySettings } from './lobby';

@Injectable()
export class LobbyService {
  private lobbies = new Map<string, Lobby>();
  private readonly logger = new Logger(LobbyService.name);

  constructor(
    @Inject(forwardRef(() => LobbyGateway))
    private lobbyGateway: LobbyGateway,
    private gameService: GameService,
  ) {}

  create(hostId: string, settings?: Partial<LobbySettings>): Lobby {
    const lobby = new Lobby(hostId, settings);
    this.lobbies.set(lobby.id, lobby);
    this.logger.log(`created lobby=${lobby.id} host=${hostId}`);
    return lobby;
  }

  get(id: string): Lobby {
    const lobby = this.lobbies.get(id);
    if (!lobby) throw new NotFoundException('Lobby not found');
    return lobby;
  }

  join(id: string, userId: string): Lobby {
    const lobby = this.get(id);
    if (lobby.players.includes(userId)) return lobby;
    if (lobby.players.length >= lobby.settings.maxPlayers) {
      throw new BadRequestException('Lobby is full');
    }
    lobby.players.push(userId);
    this.logger.log(`user=${userId} joined lobby=${id}`);
    this.lobbyGateway.broadcastLobbyUpdate(lobby);
    return lobby;
  }

  leave(id: string, userId: string): void {
    const lobby = this.get(id);
    const idx = lobby.players.indexOf(userId);
    if (idx === -1) return;
    lobby.players.splice(idx, 1);

    if (lobby.players.length === 0) {
      this.lobbies.delete(id);
      this.logger.log(`lobby=${id} deleted (empty)`);
      return;
    }

    if (lobby.hostId === userId) {
      lobby.hostId = lobby.players[0];
      this.logger.log(`lobby=${id} new host=${lobby.hostId}`);
    }

    this.logger.log(`user=${userId} left lobby=${id}`);
    this.lobbyGateway.broadcastLobbyUpdate(lobby);
  }

  updateSettings(id: string, userId: string, settings: Partial<LobbySettings>): Lobby {
    const lobby = this.get(id);
    if (lobby.hostId !== userId) throw new ForbiddenException('Only host can change settings');
    Object.assign(lobby.settings, settings);
    this.logger.log(`lobby=${id} settings updated by ${userId}`);
    this.lobbyGateway.broadcastLobbyUpdate(lobby);
    return lobby;
  }

  start(id: string, userId: string): string {
    const lobby = this.get(id);
    if (lobby.hostId !== userId) throw new ForbiddenException('Only host can start');
    if (lobby.players.length < 2) throw new BadRequestException('Need at least 2 players');

    const baseConfig = { ...GAMEMODE_CONFIGS[lobby.settings.gamemode] };
    if (!baseConfig) throw new BadRequestException('Invalid gamemode');

    baseConfig.maxPlayers = lobby.settings.maxPlayers;
    baseConfig.mapWidth = lobby.settings.mapWidth;
    baseConfig.mapHeight = lobby.settings.mapHeight;
    baseConfig.tickRateMs = lobby.settings.tickRateMs;
    baseConfig.peaceDurationMs = lobby.settings.peaceDurationMs;
    baseConfig.startingSoldiers = lobby.settings.startingSoldiers;
    baseConfig.maxBarracks = lobby.settings.maxBarracks;
    baseConfig.darknessRange = lobby.settings.darknessRange;

    const gameId = this.gameService.launchGame(lobby.players, lobby.settings.gamemode, baseConfig);
    this.lobbyGateway.broadcastLobbyStarted(lobby, gameId);
    this.lobbies.delete(id);
    this.logger.log(`lobby=${id} started game=${gameId}`);
    return gameId;
  }

  cancel(id: string, userId: string): void {
    const lobby = this.get(id);
    if (lobby.hostId !== userId) throw new ForbiddenException('Only host can cancel');
    this.lobbyGateway.broadcastLobbyCancelled(lobby);
    this.lobbies.delete(id);
    this.logger.log(`lobby=${id} cancelled by ${userId}`);
  }
}
