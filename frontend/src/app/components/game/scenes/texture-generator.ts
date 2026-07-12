import Phaser from 'phaser';

export const TILE_SIZE = 32;
export const TEXTURE_SIZE = 64;
export const SPRITE_SCALE = TILE_SIZE / TEXTURE_SIZE;

export function parseColor(hex: string): number {
  return hex ? parseInt(hex.slice(1), 16) : 0xcccccc;
}
