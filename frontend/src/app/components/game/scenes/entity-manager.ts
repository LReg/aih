import Phaser from 'phaser';
import { Entity } from '../../../types/game.types';
import { TILE_SIZE, parseColor } from './texture-generator';
import { SpritePool } from './sprite-pool';

interface Movement {
  fromX: number; fromY: number;
  toX: number; toY: number;
  elapsed: number;
  duration: number;
}

export class EntityManager {
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private pool: SpritePool;
  private moving = new Map<string, Movement>();

  constructor(private scene: Phaser.Scene) {
    this.pool = new SpritePool(scene);
  }

  reconcileFull(entities: Map<string, Entity>, playerColors: Record<string, string>, tickRateMs: number) {
    for (const [id, entity] of entities) {
      const existing = this.sprites.get(id);
      if (existing) {
        const nx = entity.x * TILE_SIZE + TILE_SIZE / 2;
        const ny = entity.y * TILE_SIZE + TILE_SIZE / 2;
        if (existing.x !== nx || existing.y !== ny) {
          this.startMove(existing, id, nx, ny, entity.type, tickRateMs);
        }
      } else {
        this.create(entity, playerColors);
      }
    }
    for (const [id, sprite] of this.sprites) {
      if (!entities.has(id)) {
        this.moving.delete(id);
        this.pool.release(sprite);
        this.sprites.delete(id);
      }
    }
  }

  reconcileIncremental(changed: Map<string, Entity>, removed: string[], playerColors: Record<string, string>, tickRateMs: number) {
    for (const [id, entity] of changed) {
      const existing = this.sprites.get(id);
      if (existing) {
        const nx = entity.x * TILE_SIZE + TILE_SIZE / 2;
        const ny = entity.y * TILE_SIZE + TILE_SIZE / 2;
        if (existing.x !== nx || existing.y !== ny) {
          this.startMove(existing, id, nx, ny, entity.type, tickRateMs);
        }
      } else {
        this.create(entity, playerColors);
      }
    }
    for (const id of removed) {
      const sprite = this.sprites.get(id);
      if (sprite) {
        this.moving.delete(id);
        this.pool.release(sprite);
        this.sprites.delete(id);
      }
    }
  }

  update(dt: number) {
    for (const [id, m] of this.moving) {
      m.elapsed += dt;
      const t = Math.min(m.elapsed / m.duration, 1);
      const sprite = this.sprites.get(id);
      if (!sprite) {
        this.moving.delete(id);
        continue;
      }
      const nx = m.fromX + (m.toX - m.fromX) * t;
      const ny = m.fromY + (m.toY - m.fromY) * t;
      sprite.x = nx;
      sprite.y = ny;
      if (t >= 1) this.moving.delete(id);
    }
  }

  private startMove(sprite: Phaser.GameObjects.Sprite, id: string, nx: number, ny: number, type: string, tickRateMs: number) {
    if (type === 'soldier') {
      this.moving.set(id, {
        fromX: sprite.x, fromY: sprite.y,
        toX: nx, toY: ny,
        elapsed: 0,
        duration: tickRateMs,
      });
    } else {
      sprite.setPosition(nx, ny);
    }
  }

  private create(entity: Entity, playerColors: Record<string, string>) {
    const x = entity.x * TILE_SIZE + TILE_SIZE / 2;
    const y = entity.y * TILE_SIZE + TILE_SIZE / 2;
    const key = entity.type === 'soldier' ? 'soldiers' : 'barracks';
    const c = parseColor(playerColors[entity.ownerId]);
    const tint = (((c >> 16) + 255) >> 1) << 16 | (((c >> 8) & 0xff) + 255) >> 1 << 8 | ((c & 0xff) + 255) >> 1;
    const sprite = this.pool.acquire(x, y, key, entity.id, tint);
    this.sprites.set(entity.id, sprite);
  }

  showAll() {
    for (const sprite of this.sprites.values()) {
      sprite.setVisible(true);
    }
  }

  updateVisibility(visibleIds: Set<string>) {
    for (const [id, sprite] of this.sprites) {
      sprite.setVisible(visibleIds.has(id));
    }
  }

  destroyAll() {
    this.moving.clear();
    for (const sprite of this.sprites.values()) {
      this.pool.release(sprite);
    }
    this.sprites.clear();
    this.pool.releaseAll();
  }

  getSprite(id: string): Phaser.GameObjects.Sprite | undefined {
    return this.sprites.get(id);
  }
}
