import { Injectable, Logger } from '@nestjs/common';
import { Gamemode } from '../game/gamemode.config';

@Injectable()
export class QueueDao {
  private readonly logger = new Logger(QueueDao.name);
  private queues = new Map<Gamemode, string[]>();

  add(gamemode: Gamemode, userId: string) {
    if (!this.queues.has(gamemode)) {
      this.queues.set(gamemode, []);
    }
    this.queues.get(gamemode)!.push(userId);
    this.logger.log(`add gamemode="${gamemode}" userId="${userId}" queue=[${this.queues.get(gamemode)}]`);
  }

  remove(gamemode: Gamemode, userId: string) {
    const queue = this.queues.get(gamemode);
    if (!queue) return;
    const idx = queue.indexOf(userId);
    if (idx !== -1) queue.splice(idx, 1);
    this.logger.log(`remove gamemode="${gamemode}" userId="${userId}" queue=[${queue}]`);
  }

  getQueue(gamemode: Gamemode): string[] {
    const q = this.queues.get(gamemode) || [];
    this.logger.log(`getQueue gamemode="${gamemode}" queue=[${q}]`);
    return q;
  }

  clear(gamemode: Gamemode) {
    this.logger.log(`clear gamemode="${gamemode}"`);
    this.queues.set(gamemode, []);
  }
}
