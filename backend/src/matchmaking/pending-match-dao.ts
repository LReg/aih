import { Injectable } from '@nestjs/common';
import { Gamemode } from '../game/gamemode.config';
import { PendingMatch } from './pending-match';

@Injectable()
export class PendingMatchDao {
  private matches = new Map<string, PendingMatch>();
  private byGamemode = new Map<Gamemode, string>();

  save(match: PendingMatch) {
    this.matches.set(match.id, match);
    this.byGamemode.set(match.gamemode, match.id);
  }

  get(id: string): PendingMatch | undefined {
    return this.matches.get(id);
  }

  getByGamemode(gamemode: Gamemode): PendingMatch | undefined {
    const id = this.byGamemode.get(gamemode);
    if (!id) return;
    return this.matches.get(id);
  }

  delete(id: string) {
    const match = this.matches.get(id);
    if (match) {
      this.byGamemode.delete(match.gamemode);
    }
    this.matches.delete(id);
  }
}
