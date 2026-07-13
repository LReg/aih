import Phaser from 'phaser';
import { Entity } from '../../../types/game.types';
import { TILE_SIZE, parseColor } from './texture-generator';
import { SpritePool } from './sprite-pool';
import { perfStart, perfEnd } from './perf';

interface Movement {
  fromX: number; fromY: number;
  toX: number; toY: number;
  elapsed: number;
  duration: number;
}

interface DotData {
  x: number;
  y: number;
  type: string;
  color: number;
}

const MAX_ANIMATED = 200;
const ZOOM_DOT_THRESHOLD = 0.4;
const DOT_SIZE = 6.5;

export class EntityManager {
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private pool: SpritePool;
  private moving = new Map<string, Movement>();
  private fogVisibleIds: Set<string> | null = null;
  private dotGraphics!: Phaser.GameObjects.Graphics;
  private usingDots = false;
  private dots = new Map<string, DotData>();
  private dotsDirty = false;

  constructor(private scene: Phaser.Scene) {
    this.pool = new SpritePool(scene);
    this.dotGraphics = scene.add.graphics().setDepth(2);
    this.usingDots = scene.cameras.main.zoom < ZOOM_DOT_THRESHOLD;
  }

  get isLod(): boolean { return this.usingDots; }

  setFogVisibleIds(ids: Set<string> | null) { this.fogVisibleIds = ids; }

  private wasFogged(id: string): boolean {
    return this.fogVisibleIds !== null && !this.fogVisibleIds.has(id);
  }

  private snapOrMove(sprite: Phaser.GameObjects.Sprite, id: string, nx: number, ny: number, type: string, tickRateMs: number) {
    const d = this.dots.get(id);
    if (d) { d.x = nx; d.y = ny; }

    if (this.wasFogged(id) || this.usingDots) {
      this.moving.delete(id);
      sprite.setPosition(nx, ny);
    } else {
      this.startMove(sprite, id, nx, ny, type, tickRateMs);
    }
  }

  private upsertDot(id: string, x: number, y: number, type: string, color: number) {
    const existing = this.dots.get(id);
    if (existing) {
      if (existing.x !== x || existing.y !== y) this.dotsDirty = true;
      existing.x = x;
      existing.y = y;
    } else {
      this.dots.set(id, { x, y, type, color });
      this.dotsDirty = true;
    }
  }

  reconcileFull(entities: Map<string, Entity>, playerColors: Record<string, string>, tickRateMs: number) {
    perfStart('em.reconcileFull');
    for (const [id, entity] of entities) {
      const x = entity.x * TILE_SIZE + TILE_SIZE / 2;
      const y = entity.y * TILE_SIZE + TILE_SIZE / 2;
      const color = parseColor(playerColors[entity.ownerId]);
      this.upsertDot(id, x, y, entity.type, color);

      if (!this.usingDots) {
        const existing = this.sprites.get(id);
        if (existing) {
          if (existing.x !== x || existing.y !== y) {
            this.snapOrMove(existing, id, x, y, entity.type, tickRateMs);
          }
        } else {
          this.createSprite(id, x, y, entity.type, color);
        }
      }
    }
    for (const [id, sprite] of this.sprites) {
      if (!entities.has(id)) {
        this.moving.delete(id);
        if (this.dots.delete(id)) this.dotsDirty = true;
        this.pool.release(sprite);
        this.sprites.delete(id);
      }
    }
    perfEnd('em.reconcileFull');
  }

  reconcileIncremental(changed: Map<string, Entity>, removed: string[], playerColors: Record<string, string>, tickRateMs: number) {
    perfStart('em.reconcileInc');
    for (const [id, entity] of changed) {
      const x = entity.x * TILE_SIZE + TILE_SIZE / 2;
      const y = entity.y * TILE_SIZE + TILE_SIZE / 2;
      const color = parseColor(playerColors[entity.ownerId]);
      this.upsertDot(id, x, y, entity.type, color);

      if (!this.usingDots) {
        const existing = this.sprites.get(id);
        if (existing) {
          if (existing.x !== x || existing.y !== y) {
            this.snapOrMove(existing, id, x, y, entity.type, tickRateMs);
          }
        } else {
          this.createSprite(id, x, y, entity.type, color);
        }
      }
    }
    for (const id of removed) {
      this.moving.delete(id);
      if (this.dots.delete(id)) this.dotsDirty = true;
      const sprite = this.sprites.get(id);
      if (sprite) {
        this.pool.release(sprite);
        this.sprites.delete(id);
      }
    }
    perfEnd('em.reconcileInc');
  }

  update(dt: number) {
    perfStart('em.update');
    this.checkLod();
    if (this.usingDots) {
      if (this.dotsDirty) {
        this.rebuildDotRT();
        this.dotsDirty = false;
      }
      perfEnd('em.update');
      return;
    }

    if (this.moving.size > MAX_ANIMATED) {
      for (const [id, m] of this.moving) {
        const sprite = this.sprites.get(id);
        if (sprite) { sprite.x = m.toX; sprite.y = m.toY; }
      }
      this.moving.clear();
      perfEnd('em.update');
      return;
    }
    for (const [id, m] of this.moving) {
      if (this.fogVisibleIds && !this.fogVisibleIds.has(id)) {
        m.elapsed += dt;
        if (m.elapsed >= m.duration) {
          const sprite = this.sprites.get(id);
          if (sprite) { sprite.x = m.toX; sprite.y = m.toY; }
          this.moving.delete(id);
        }
        continue;
      }
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
    perfEnd('em.update');
  }

  private checkLod() {
    perfStart('em.checkLod');
    const zoom = this.scene.cameras.main.zoom;
    if (zoom < ZOOM_DOT_THRESHOLD && !this.usingDots) {
      this.usingDots = true;
      this.moving.clear();
      for (const sprite of this.sprites.values()) sprite.destroy();
      this.sprites.clear();
      this.pool.releaseAll();
      this.dotGraphics.destroy();
      this.dotGraphics = this.scene.add.graphics().setDepth(2);
      this.dotsDirty = true;

    } else if (zoom >= ZOOM_DOT_THRESHOLD && this.usingDots) {
      this.usingDots = false;
      this.dotGraphics.clear();
      for (const [id, d] of this.dots) {
        if (!this.wasFogged(id)) {
          this.createSprite(id, d.x, d.y, d.type, d.color);
        }
      }
    }
    perfEnd('em.checkLod');
  }

  private rebuildDotRT() {
    perfStart('em.rebuildDotRT');
    const zoom = this.scene.cameras.main.zoom;
    const ds = Math.min(Math.max(2, Math.round(DOT_SIZE / zoom)), 27);
    const half = ds / 2;
    this.dotGraphics.clear();
    const soldierByColor = new Map<number, { x: number; y: number }[]>();
    const barracksByColor = new Map<number, { x: number; y: number }[]>();
    for (const [id, d] of this.dots) {
      if (this.wasFogged(id)) continue;
      const map = d.type === 'barracks' ? barracksByColor : soldierByColor;
      let list = map.get(d.color);
      if (!list) { list = []; map.set(d.color, list); }
      list.push(d);
    }
    for (const [color, list] of soldierByColor) {
      this.dotGraphics.fillStyle(color, 0.75);
      for (const d of list) {
        this.dotGraphics.fillRect(d.x - half, d.y - half, ds, ds);
      }
    }
    for (const [color, list] of barracksByColor) {
      const r = Math.round(((color >> 16) & 0xff) * 0.5);
      const g = Math.round(((color >> 8) & 0xff) * 0.5);
      const b = Math.round((color & 0xff) * 0.5);
      this.dotGraphics.fillStyle((r << 16) | (g << 8) | b, 0.75);
      for (const d of list) {
        this.dotGraphics.fillRect(d.x - half, d.y - half, ds, ds);
      }
    }
    perfEnd('em.rebuildDotRT');
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

  private createSprite(id: string, x: number, y: number, type: string, color: number) {
    const key = type === 'soldier' ? 'soldiers' : 'barracks';
    const tint = (((color >> 16) + 255) >> 1) << 16 | (((color >> 8) & 0xff) + 255) >> 1 << 8 | ((color & 0xff) + 255) >> 1;
    const sprite = this.pool.acquire(x, y, key, id, tint);
    this.sprites.set(id, sprite);
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
    this.dots.clear();
    this.dotGraphics.destroy();
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
    this.pool.releaseAll();
  }

  getSprite(id: string): Phaser.GameObjects.Sprite | undefined {
    return this.sprites.get(id);
  }

  getEntityPosition(id: string): { x: number; y: number } | undefined {
    const sprite = this.sprites.get(id);
    if (sprite) return { x: sprite.x, y: sprite.y };
    const d = this.dots.get(id);
    if (d) return { x: d.x, y: d.y };
    return undefined;
  }
}
