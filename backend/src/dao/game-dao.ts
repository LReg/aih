import { Injectable } from '@nestjs/common';
import { Game } from '../game/game';

@Injectable()
export class GameDao {
  private games = new Map<string, Game>();

  getGame(id: string): Game | undefined {
    return this.games.get(id);
  }

  saveGame(game: Game) {
    this.games.set(game.id, game);
  }

  removeGame(id: string) {
    this.games.delete(id);
  }
}
