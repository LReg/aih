import Phaser from 'phaser';
import { Entity, GameState } from '../../../types/game.types';
import { TILE_SIZE } from './texture-generator';

export class OverlayRenderer {
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private busyGraphics!: Phaser.GameObjects.Graphics;
  private attackEyeGraphics!: Phaser.GameObjects.Graphics;
  private selectionRectGraphics!: Phaser.GameObjects.Graphics;
  private targetingGraphics!: Phaser.GameObjects.Graphics;
  private spreadGraphics!: Phaser.GameObjects.Graphics;
  private targetingLabel!: Phaser.GameObjects.Text;

  private busyIds = new Set<string>();
  private attackIds = new Set<string>();
  private selectedIds = new Set<string>();
  private playerId = '';
  private visibleIds: Set<string> | null = null;

  constructor(private scene: Phaser.Scene) {}

  create() {
    this.targetingGraphics = this.scene.add.graphics().setDepth(1);
    this.spreadGraphics = this.scene.add.graphics().setDepth(2);
    this.highlightGraphics = this.scene.add.graphics().setDepth(2);
    this.busyGraphics = this.scene.add.graphics().setDepth(3);
    this.attackEyeGraphics = this.scene.add.graphics().setDepth(4);
    this.selectionRectGraphics = this.scene.add.graphics().setDepth(3);
    this.targetingLabel = this.scene.add.text(
      this.scene.cameras.main.width / 2, 12, '',
      {
        fontSize: '16px', color: '#ffffff', backgroundColor: '#00000099',
        padding: { x: 12, y: 6 },
      },
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000).setVisible(false);
  }

  updateAll(entitiesMap: Map<string, Entity> | null, selectedIds: Set<string>, playerId: string, visibleIds?: Set<string>) {
    this.selectedIds = selectedIds;
    this.playerId = playerId;
    this.visibleIds = visibleIds || null;
    this.busyIds.clear();
    this.attackIds.clear();
    if (!entitiesMap) return;

    for (const [id, entity] of entitiesMap) {
      if (this.visibleIds && !this.visibleIds.has(id)) continue;
      if (entity.type !== 'soldier') continue;
      if (entity.ownerId === playerId && entity.state.status === 'building-barracks') {
        this.busyIds.add(id);
      }
      if (entity.state.status === 'attacking') {
        this.attackIds.add(id);
      }
    }
  }

  updatePositions(getSpritePos: (id: string) => { x: number; y: number } | undefined, visibleIds?: Set<string>) {
    if (visibleIds) this.visibleIds = visibleIds;
    this.busyGraphics.clear();
    this.attackEyeGraphics.clear();
    this.highlightGraphics.clear();
    if (this.selectedIds.size === 0 && this.busyIds.size === 0 && this.attackIds.size === 0) return;

    for (const id of this.busyIds) {
      if (this.visibleIds && !this.visibleIds.has(id)) continue;
      const pos = getSpritePos(id);
      if (!pos) continue;
      this.busyGraphics.fillStyle(0xff8800, 0.9);
      this.busyGraphics.fillCircle(pos.x, pos.y, 4);
    }

    for (const id of this.attackIds) {
      if (this.visibleIds && !this.visibleIds.has(id)) continue;
      const pos = getSpritePos(id);
      if (!pos) continue;
      this.attackEyeGraphics.fillStyle(0xff0000, 1);
      this.attackEyeGraphics.fillCircle(pos.x - 2, pos.y - 7, 1.5);
      this.attackEyeGraphics.fillCircle(pos.x + 2, pos.y - 7, 1.5);
    }

    if (this.selectedIds.size === 0) return;

    const half = TILE_SIZE / 2;
    const len = 6;
    this.highlightGraphics.lineStyle(1.5, 0xffff00, 0.6);
    for (const id of this.selectedIds) {
      const pos = getSpritePos(id);
      if (!pos) continue;
      const x = pos.x;
      const y = pos.y;

      this.highlightGraphics.beginPath();
      this.highlightGraphics.moveTo(x - half, y - half);
      this.highlightGraphics.lineTo(x - half + len, y - half);
      this.highlightGraphics.moveTo(x - half, y - half);
      this.highlightGraphics.lineTo(x - half, y - half + len);

      this.highlightGraphics.moveTo(x + half, y - half);
      this.highlightGraphics.lineTo(x + half - len, y - half);
      this.highlightGraphics.moveTo(x + half, y - half);
      this.highlightGraphics.lineTo(x + half, y - half + len);

      this.highlightGraphics.moveTo(x - half, y + half);
      this.highlightGraphics.lineTo(x - half + len, y + half);
      this.highlightGraphics.moveTo(x - half, y + half);
      this.highlightGraphics.lineTo(x - half, y + half - len);

      this.highlightGraphics.moveTo(x + half, y + half);
      this.highlightGraphics.lineTo(x + half - len, y + half);
      this.highlightGraphics.moveTo(x + half, y + half);
      this.highlightGraphics.lineTo(x + half, y + half - len);

      this.highlightGraphics.strokePath();
    }
  }

  drawSelectionRect(r: { x1: number; y1: number; x2: number; y2: number }) {
    this.selectionRectGraphics.clear();
    const minX = Math.min(r.x1, r.x2);
    const minY = Math.min(r.y1, r.y2);
    const w = Math.abs(r.x2 - r.x1);
    const h = Math.abs(r.y2 - r.y1);
    this.selectionRectGraphics.fillStyle(0xffff00, 0.1);
    this.selectionRectGraphics.fillRect(minX, minY, w, h);
    this.selectionRectGraphics.lineStyle(1, 0xffff00, 0.6);
    this.selectionRectGraphics.strokeRect(minX, minY, w, h);
  }

  clearSelection() {
    this.selectedIds.clear();
    this.selectionRectGraphics.clear();
  }

  clearSelectionRect() {
    this.selectionRectGraphics.clear();
  }

  drawTargetingHover(worldX: number, worldY: number, action: 'walk' | 'attack' | null, state: GameState | null) {
    this.targetingGraphics.clear();
    if (!state || !action) return;
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    const { width, height } = state.map;
    if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) return;

    const color = action === 'attack' ? 0xff3333 : 0x33ff33;
    this.targetingGraphics.fillStyle(color, 0.25);
    this.targetingGraphics.fillRect(tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    this.targetingGraphics.lineStyle(2, color, 0.8);
    this.targetingGraphics.strokeRect(tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }

  clearTargeting() {
    this.targetingGraphics.clear();
    this.spreadGraphics.clear();
  }

  drawSpreadPreview(positions: { x: number; y: number }[], color: number) {
    this.spreadGraphics.clear();
    for (const p of positions) {
      const cx = p.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = p.y * TILE_SIZE + TILE_SIZE / 2;
      this.spreadGraphics.fillStyle(color, 0.35);
      this.spreadGraphics.fillRect(p.x * TILE_SIZE, p.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      this.spreadGraphics.lineStyle(1.5, color, 0.7);
      this.spreadGraphics.strokeRect(p.x * TILE_SIZE, p.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      this.spreadGraphics.fillStyle(color, 0.9);
      this.spreadGraphics.fillCircle(cx, cy, 3);
    }
  }

  showTargetingLabel(text: string | null) {
    if (text) {
      this.targetingLabel.setText(text).setVisible(true);
    } else {
      this.targetingLabel.setVisible(false);
    }
  }

  destroy() {
    this.targetingGraphics.destroy();
    this.spreadGraphics.destroy();
    this.highlightGraphics.destroy();
    this.busyGraphics.destroy();
    this.attackEyeGraphics.destroy();
    this.selectionRectGraphics.destroy();
    this.targetingLabel.destroy();
  }
}
