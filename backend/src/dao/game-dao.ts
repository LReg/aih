import { Injectable } from '@nestjs/common';

@Injectable()
export class GameDao {
  private games = new Map<string, any>();

  getGame(id: string): any {
    return this.games.get(id);
  }

  saveGame(game: any) {
    this.games.set(game.id || game.gameId, game);
  }

  removeGame(id: string) {
    this.games.delete(id);
  }
}
