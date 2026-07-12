import { randomUUID } from 'crypto';
import { Gamemode } from '../game/gamemode.config';

export interface LobbySettings {
  gamemode: Gamemode;
  maxPlayers: number;
  mapWidth: number;
  mapHeight: number;
  tickRateMs: number;
  peaceDurationMs: number;
  startingSoldiers: number;
  maxBarracks: number;
  darknessRange: number;
}

export class Lobby {
  readonly id: string = randomUUID();
  hostId: string;
  players: string[];
  settings: LobbySettings;
  createdAt: Date;

  constructor(hostId: string, settings?: Partial<LobbySettings>) {
    this.hostId = hostId;
    this.players = [hostId];
    this.settings = {
      gamemode: Gamemode.Casual,
      maxPlayers: 5,
      mapWidth: 100,
      mapHeight: 100,
      tickRateMs: 500,
      peaceDurationMs: 100000,
      startingSoldiers: 5,
      maxBarracks: 15,
      darknessRange: 10,
      ...settings,
    };
    this.createdAt = new Date();
  }
}
