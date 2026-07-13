import Phaser from 'phaser';
import { SPRITE_SCALE } from './texture-generator';

export class SpritePool {
  constructor(private scene: Phaser.Scene) {}

  acquire(x: number, y: number, key: string, entityId: string, tint: number): Phaser.GameObjects.Sprite {
    const sprite = this.scene.add.sprite(x, y, key);
    sprite.setScale(SPRITE_SCALE);
    sprite.setDepth(2);
    sprite.setData('entityId', entityId);
    sprite.setTint(tint);
    return sprite;
  }

  release(sprite: Phaser.GameObjects.Sprite) {
    sprite.destroy();
  }

  releaseAll() {
  }
}
