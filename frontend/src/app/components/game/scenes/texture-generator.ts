import Phaser from 'phaser';

export const TILE_SIZE = 32;
export const TEXTURE_SIZE = 256;
export const SPRITE_SCALE = TILE_SIZE / TEXTURE_SIZE;

const ASSET_KEYS: Record<string, string> = {
  soldier: 'soldiers',
  barracks: 'barracks',
};

export function makeEntityTexture(scene: Phaser.Scene, color: number, type: string): string {
  const key = `${type}_${color}`;
  if (scene.textures.exists(key)) return key;

  const srcKey = ASSET_KEYS[type];
  if (!srcKey || !scene.textures.exists(srcKey)) return '';

  const src = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement;
  const canvas = scene.textures.createCanvas(key, TEXTURE_SIZE, TEXTURE_SIZE);
  if (!canvas) return '';
  const ctx = canvas.getContext();

  const srcSize = Math.min(src.width, src.height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, 0, 0, srcSize, srcSize, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.17;
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  canvas.refresh();
  return key;
}

export function parseColor(hex: string): number {
  return hex ? parseInt(hex.slice(1), 16) : 0xcccccc;
}
