import { Injectable, Logger } from '@nestjs/common';
import { GameService } from '../game/game.service';
import { GAMEMODE_CONFIGS, Gamemode } from '../game/gamemode.config';

@Injectable()
export class WorldService {
  private worlds: string[] = [];
  private readonly logger = new Logger(WorldService.name);

  constructor(private gameService: GameService) {}

  joinWorld(userId: string, username?: string): { gameId: string } {
    const gameId = this.findJoinableWorld() ?? this.createNewWorld();
    this.gameService.addPlayerToGame(gameId, userId, username);
    return { gameId };
  }

  private findJoinableWorld(): string | null {
    for (const id of this.worlds) {
      const game = this.gameService.getGame(id);
      if (game && game.state === 'running' && game.players?.length < GAMEMODE_CONFIGS[Gamemode.World].maxPlayers) {
        return id;
      }
    }
    return null;
  }

  private createNewWorld(): string {
    const config = GAMEMODE_CONFIGS[Gamemode.World];
    const gameId = this.gameService.launchGame([], Gamemode.World, config);
    this.worlds.push(gameId);
    this.logger.log(`new world created id=${gameId}`);
    return gameId;
  }

  onWorldEmpty(gameId: string): void {
    this.worlds = this.worlds.filter(id => id !== gameId);
    this.logger.log(`world id=${gameId} removed from pool`);
  }

  getStatus(): { activePlayers: number; maxPlayers: number } {
    const maxPlayers = GAMEMODE_CONFIGS[Gamemode.World].maxPlayers;
    for (const id of this.worlds) {
      const game = this.gameService.getGame(id);
      if (game && game.state === 'running') {
        return { activePlayers: game.players?.length || 0, maxPlayers };
      }
    }
    return { activePlayers: 0, maxPlayers };
  }
}
