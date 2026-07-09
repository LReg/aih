import { Injectable } from '@nestjs/common';
import { Gamemode } from '../game/gamemode.config';

@Injectable()
export class QueueDao {
  private queues = new Map<Gamemode, string[]>();

  add(gamemode: Gamemode, userId: string) {
    if (!this.queues.has(gamemode)) {
      this.queues.set(gamemode, []);
    }
    this.queues.get(gamemode)!.push(userId);
  }

  remove(gamemode: Gamemode, userId: string) {
    const queue = this.queues.get(gamemode);
    if (!queue) return;
    const idx = queue.indexOf(userId);
    if (idx !== -1) queue.splice(idx, 1);
  }

  getQueue(gamemode: Gamemode): string[] {
    return this.queues.get(gamemode) || [];
  }

  clear(gamemode: Gamemode) {
    this.queues.set(gamemode, []);
  }
}
