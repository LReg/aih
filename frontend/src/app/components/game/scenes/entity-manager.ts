import Phaser from 'phaser';
import { Entity, Effect } from '../../../types/game.types';
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
  soldierClass?: string;
  color: number;
  fogged: boolean;
}

interface ArrowEffect {
  fromX: number; fromY: number;
  toX: number; toY: number;
  elapsed: number;
  duration: number;
  color: number;
  type: 'arrow' | 'melee';
}

const MAX_ANIMATED = 3000;
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
  private arrows: ArrowEffect[] = [];
  private arrowGraphics!: Phaser.GameObjects.Graphics;
  private healthData = new Map<string, { hp: number; maxHp: number }>();
  private healthbarGraphics!: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    this.pool = new SpritePool(scene);
    this.dotGraphics = scene.add.graphics().setDepth(2);
    this.arrowGraphics = scene.add.graphics().setDepth(3);
    this.healthbarGraphics = scene.add.graphics().setDepth(5);
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

  private upsertDot(id: string, x: number, y: number, type: string, color: number, soldierClass?: string) {
    const existing = this.dots.get(id);
    const fogged = this.wasFogged(id);
    if (existing) {
      if (existing.x !== x || existing.y !== y || existing.fogged !== fogged) this.dotsDirty = true;
      existing.x = x;
      existing.y = y;
      existing.fogged = fogged;
    } else {
      this.dots.set(id, { x, y, type, color, soldierClass, fogged });
      this.dotsDirty = true;
    }
  }

  reconcileFull(entities: Map<string, Entity>, playerColors: Record<string, string>, tickRateMs: number) {
    perfStart('em.reconcileFull');
    for (const [id, entity] of entities) {
      const x = entity.x * TILE_SIZE + TILE_SIZE / 2;
      const y = entity.y * TILE_SIZE + TILE_SIZE / 2;
      const color = parseColor(playerColors[entity.ownerId]);
      const soldierClass = entity.class;
      this.upsertDot(id, x, y, entity.type, color, soldierClass);
      this.healthData.set(id, { hp: entity.hp, maxHp: entity.maxHp });

      if (!this.usingDots) {
        const existing = this.sprites.get(id);
        if (existing) {
          if (existing.x !== x || existing.y !== y) {
            this.snapOrMove(existing, id, x, y, entity.type, tickRateMs);
          }
        } else {
          this.createSprite(id, x, y, entity.type, color, soldierClass);
        }
      }
    }
    for (const [id, sprite] of this.sprites) {
      if (!entities.has(id)) {
        this.moving.delete(id);
        this.healthData.delete(id);
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
      const soldierClass = entity.class;
      this.upsertDot(id, x, y, entity.type, color, soldierClass);
      this.healthData.set(id, { hp: entity.hp, maxHp: entity.maxHp });

      if (!this.usingDots) {
        const existing = this.sprites.get(id);
        if (existing) {
          if (existing.x !== x || existing.y !== y) {
            this.snapOrMove(existing, id, x, y, entity.type, tickRateMs);
          }
        } else {
          this.createSprite(id, x, y, entity.type, color, soldierClass);
        }
      }
    }
    for (const id of removed) {
      this.moving.delete(id);
      this.healthData.delete(id);
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
      this.arrows.length = 0;
      this.arrowGraphics.clear();
      if (this.dotsDirty) {
        this.rebuildDotRT();
        this.dotsDirty = false;
      }
      perfEnd('em.update');
      return;
    }

    this.updateArrows();
    this.renderHealthbars();

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
      this.healthbarGraphics.clear();
      for (const sprite of this.sprites.values()) sprite.destroy();
      this.sprites.clear();
      this.pool.releaseAll();
      this.dotGraphics.destroy();
      this.dotGraphics = this.scene.add.graphics().setDepth(2);
      this.dotsDirty = true;

    } else if (zoom >= ZOOM_DOT_THRESHOLD && this.usingDots) {
      this.usingDots = false;
      this.dotGraphics.clear();
      this.healthbarGraphics.clear();
      for (const [id, d] of this.dots) {
        if (!this.wasFogged(id)) {
          this.createSprite(id, d.x, d.y, d.type, d.color, d.soldierClass);
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
    const archerByColor = new Map<number, { x: number; y: number }[]>();
    const tankByColor = new Map<number, { x: number; y: number }[]>();
    const barracksByColor = new Map<number, { x: number; y: number }[]>();
    for (const [id, d] of this.dots) {
      if (this.wasFogged(id)) continue;
      if (d.type === 'barracks') {
        let list = barracksByColor.get(d.color);
        if (!list) { list = []; barracksByColor.set(d.color, list); }
        list.push(d);
      } else if (d.soldierClass === 'archer') {
        let list = archerByColor.get(d.color);
        if (!list) { list = []; archerByColor.set(d.color, list); }
        list.push(d);
      } else if (d.soldierClass === 'tank') {
        let list = tankByColor.get(d.color);
        if (!list) { list = []; tankByColor.set(d.color, list); }
        list.push(d);
      } else {
        let list = soldierByColor.get(d.color);
        if (!list) { list = []; soldierByColor.set(d.color, list); }
        list.push(d);
      }
    }
    for (const [color, list] of soldierByColor) {
      this.dotGraphics.fillStyle(color, 0.75);
      for (const d of list) {
        this.dotGraphics.fillRect(d.x - half, d.y - half, ds, ds);
      }
    }
    for (const [color, list] of archerByColor) {
      this.dotGraphics.fillStyle(color, 0.75);
      for (const d of list) {
        this.dotGraphics.fillCircle(d.x, d.y, half);
      }
    }
    for (const [color, list] of tankByColor) {
      this.dotGraphics.fillStyle(color, 0.75);
      for (const d of list) {
        const w = half * 0.9;
        const h = half * 1.6;
        this.dotGraphics.fillRect(d.x - w, d.y - h * 0.35, w * 2, h * 0.7);
        this.dotGraphics.fillTriangle(
          d.x - w * 1.1, d.y + h * 0.35,
          d.x + w * 1.1, d.y + h * 0.35,
          d.x, d.y + h * 0.9,
        );
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

  private textureKey(entityType: string, soldierClass?: string): string {
    if (entityType === 'barracks') return 'barracks';
    if (soldierClass === 'archer') return 'archer';
    if (soldierClass === 'tank') return 'tank';
    return 'soldiers';
  }

  private createSprite(id: string, x: number, y: number, type: string, color: number, soldierClass?: string) {
    const key = this.textureKey(type, soldierClass);
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

  get spriteCount(): number { return this.sprites.size; }
  get dotCount(): number { return this.dots.size; }

  destroyAll() {
    this.moving.clear();
    this.dots.clear();
    this.healthData.clear();
    this.arrows.length = 0;
    this.dotGraphics.destroy();
    this.arrowGraphics.destroy();
    this.healthbarGraphics.destroy();
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
    this.pool.releaseAll();
  }

  getSprite(id: string): Phaser.GameObjects.Sprite | undefined {
    return this.sprites.get(id);
  }

  applyEffects(effects: Effect[], tickRateMs: number) {
    for (const eff of effects) {
      const fromX = eff.fromTileX * TILE_SIZE + TILE_SIZE / 2;
      const fromY = eff.fromTileY * TILE_SIZE + TILE_SIZE / 2;
      const toX = eff.toTileX * TILE_SIZE + TILE_SIZE / 2;
      const toY = eff.toTileY * TILE_SIZE + TILE_SIZE / 2;
      if (eff.type === 'arrow') {
        this.arrows.push({
          type: 'arrow',
          fromX, fromY, toX, toY,
          elapsed: 0,
          duration: Math.min(tickRateMs, 500),
          color: 0xffcc00,
        });
      } else if (eff.type === 'melee') {
        this.arrows.push({
          type: 'melee',
          fromX, fromY, toX, toY,
          elapsed: 0,
          duration: Math.min(tickRateMs, 200),
          color: 0xffffff,
        });
      }
    }
  }

  private renderHealthbars() {
    this.healthbarGraphics.clear();
    for (const [id, h] of this.healthData) {
      if (h.hp >= h.maxHp) continue;
      const sprite = this.sprites.get(id);
      if (!sprite || !sprite.visible) continue;
      const barW = 24;
      const barH = 3;
      const x = sprite.x - barW / 2;
      const y = sprite.y - TILE_SIZE / 2 - 6;
      const pct = h.hp / h.maxHp;
      this.healthbarGraphics.fillStyle(0x333333, 0.8);
      this.healthbarGraphics.fillRect(x, y, barW, barH);
      const color = pct > 0.5 ? 0x22cc22 : pct > 0.25 ? 0xcccc22 : 0xcc2222;
      this.healthbarGraphics.fillStyle(color, 1);
      this.healthbarGraphics.fillRect(x, y, barW * pct, barH);
    }
  }

  private updateArrows() {
    this.arrowGraphics.clear();
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.elapsed += 16;
      if (a.elapsed >= a.duration) {
        this.arrows.splice(i, 1);
        continue;
      }
      const t = a.elapsed / a.duration;
      if (a.type === 'melee') {
        const midX = (a.fromX + a.toX) / 2;
        const midY = (a.fromY + a.toY) / 2;
        const angle = Math.atan2(a.toY - a.fromY, a.toX - a.fromX);
        const radius = Math.sqrt((a.toX - a.fromX) ** 2 + (a.toY - a.fromY) ** 2) / 2 * 0.7;
        const alpha = 0.9 * (1 - t);
        this.arrowGraphics.lineStyle(4, a.color, alpha);
        this.arrowGraphics.beginPath();
        this.arrowGraphics.arc(midX, midY, Math.max(radius, 4), angle - Math.PI / 3, angle + Math.PI / 3, false);
        this.arrowGraphics.strokePath();
      } else {
        const x = a.fromX + (a.toX - a.fromX) * t;
        const y = a.fromY + (a.toY - a.fromY) * t;
        this.arrowGraphics.lineStyle(2, a.color, 0.9);
        this.arrowGraphics.beginPath();
        this.arrowGraphics.moveTo(a.fromX, a.fromY);
        this.arrowGraphics.lineTo(x, y);
        this.arrowGraphics.strokePath();
      }
    }
  }

  getEntityPosition(id: string): { x: number; y: number } | undefined {
    const sprite = this.sprites.get(id);
    if (sprite) return { x: sprite.x, y: sprite.y };
    const d = this.dots.get(id);
    if (d) return { x: d.x, y: d.y };
    return undefined;
  }
}
