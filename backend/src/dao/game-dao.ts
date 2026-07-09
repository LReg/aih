import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Game } from '../game/game';

@Injectable()
export class GameDao {
  private games = new Map<string, Game>();

  constructor(private db: DatabaseService) {}

  getGame(id: string): Game | undefined {
    return this.games.get(id);
  }

  saveGame(game: Game) {
    this.games.set(game.id, game);
    this.persist(game);
  }

  removeGame(id: string) {
    this.games.delete(id);
  }

  private async persist(game: Game) {
    try {
      await this.db.db.collection('games').updateOne(
        { id: game.id },
        { $set: game.toJSON() },
        { upsert: true },
      );
    } catch (err) {
      console.error('Failed to persist game:', err);
    }
  }
}
