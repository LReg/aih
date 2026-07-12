import Phaser from 'phaser';
import { SPRITE_SCALE } from './texture-generator';

export class SpritePool {
  private available: Phaser.GameObjects.Sprite[] = [];

  constructor(private scene: Phaser.Scene) {}

  acquire(x: number, y: number, key: string, entityId: string, tint: number): Phaser.GameObjects.Sprite {
    let sprite = this.available.pop();
    if (sprite) {
      sprite.setTexture(key);
      sprite.setPosition(x, y);
      sprite.setScale(SPRITE_SCALE);
      sprite.setData('entityId', entityId);
      sprite.setVisible(true);
      sprite.setActive(true);
      sprite.setTint(tint);
    } else {
      sprite = this.scene.add.sprite(x, y, key);
      sprite.setScale(SPRITE_SCALE);
      sprite.setData('entityId', entityId);
      sprite.setTint(tint);
    }
    return sprite;
  }

  release(sprite: Phaser.GameObjects.Sprite) {
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.setTint(0xffffff);
    this.available.push(sprite);
  }

  releaseAll() {
    for (const sprite of this.available) {
      sprite.destroy();
    }
    this.available = [];
  }
}
