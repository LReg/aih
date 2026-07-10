import Phaser from 'phaser';
import { Entity, GameState } from '../../../types/game.types';
import { TILE_SIZE, SPRITE_SCALE, makeEntityTexture, parseColor } from './texture-generator';

export class EntityManager {
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();

  constructor(private scene: Phaser.Scene) {}

  reconcile(state: GameState, tickRateMs: number) {
    const incoming = new Map(state.map.entities);
    for (const [id, entity] of incoming) {
      const existing = this.sprites.get(id);
      if (existing) {
        const nx = entity.x * TILE_SIZE + TILE_SIZE / 2;
        const ny = entity.y * TILE_SIZE + TILE_SIZE / 2;
        if (existing.x !== nx || existing.y !== ny) {
          this.scene.tweens.killTweensOf(existing);
          if (entity.type === 'soldier') {
            this.scene.tweens.add({
              targets: existing,
              x: nx, y: ny,
              duration: tickRateMs * 0.85,
              ease: 'Linear',
            });
          } else {
            existing.setPosition(nx, ny);
          }
        }
      } else {
        this.create(entity, state.playerColors);
      }
    }
    for (const [id, sprite] of this.sprites) {
      if (!incoming.has(id)) {
        this.scene.tweens.killTweensOf(sprite);
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }

  private create(entity: Entity, playerColors: Record<string, string>) {
    const x = entity.x * TILE_SIZE + TILE_SIZE / 2;
    const y = entity.y * TILE_SIZE + TILE_SIZE / 2;
    const color = parseColor(playerColors[entity.ownerId]);
    const key = makeEntityTexture(this.scene, color, entity.type);
    const sprite = this.scene.add.sprite(x, y, key);
    sprite.setScale(SPRITE_SCALE);
    sprite.setData('entityId', entity.id);
    this.sprites.set(entity.id, sprite);
  }

  destroyAll() {
    for (const sprite of this.sprites.values()) {
      this.scene.tweens.killTweensOf(sprite);
      sprite.destroy();
    }
    this.sprites.clear();
  }

  getSprite(id: string): Phaser.GameObjects.Sprite | undefined {
    return this.sprites.get(id);
  }
}
