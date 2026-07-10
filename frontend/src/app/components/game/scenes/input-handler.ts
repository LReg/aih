import Phaser from 'phaser';
import { Subject } from 'rxjs';
import { GameState, Entity } from '../../../types/game.types';
import { TILE_SIZE } from './texture-generator';
import { OverlayRenderer } from './overlay-renderer';

export interface GameSceneAPI {
  gameState(): GameState | null;
  selectedIds(): Set<string>;
  setSelectedIds(v: Set<string>): void;
  playerId(): string;
  targetingAction(): 'walk' | 'attack' | null;
  overlays: OverlayRenderer;
  entityAt(tileX: number, tileY: number): Entity | null;
  updateHighlights(): void;
  cancelTargeting(): void;
  onSelectionChanged: Subject<string[]>;
  onActionRequest: Subject<{ action: string; entityIds: string[]; x: number; y: number }>;
  onTargetingChanged: Subject<'walk' | 'attack' | null>;
}

export class InputHandler {
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private leftDown: { sx: number; sy: number; wx: number; wy: number; camX: number; camY: number } | null = null;
  private isPanning = false;
  private pendingButton: number | null = null;
  private dragStart: { wx: number; wy: number } | null = null;
  private isDragging = false;
  private dragRect: { x1: number; y1: number; x2: number; y2: number } | null = null;
  private pinchDist = 0;
  private isMobile = false;
  private longPressTimer: number | null = null;
  private isLongPressSelect = false;
  private cursorX = 0;
  private cursorY = 0;

  constructor(private scene: Phaser.Scene, private api: GameSceneAPI) {}

  setup() {
    this.isMobile = this.scene.sys.game.device.input.touch;
    this.shiftKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.scene.input.addPointer(2);

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointerDown(pointer));
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.cursorX = pointer.x;
      this.cursorY = pointer.y;
      this.onPointerMove(pointer);
    });
    this.scene.input.on('pointerup', () => this.onPointerUp());

    this.scene.input.on('wheel', (_pointer: unknown, _gos: unknown, _dx: number, dy: number) => {
      const cam = this.scene.cameras.main;
      const newZoom = Phaser.Math.Clamp(cam.zoom - dy * 0.0002, 0.1, 6);
      if (newZoom === cam.zoom) return;
      const zoomingIn = newZoom > cam.zoom;
      if (zoomingIn) {
        const worldX = cam.scrollX + this.cursorX / cam.zoom;
        const worldY = cam.scrollY + this.cursorY / cam.zoom;
        const targetX = worldX - cam.width / (2 * newZoom);
        const targetY = worldY - cam.height / (2 * newZoom);
        cam.setZoom(newZoom);
        cam.scrollX = cam.scrollX + (targetX - cam.scrollX) / 6;
        cam.scrollY = cam.scrollY + (targetY - cam.scrollY) / 6;
      } else {
        cam.setZoom(newZoom);
      }
    });

    this.scene.input.keyboard!.on('keydown-ESC', () => {
      if (this.api.targetingAction()) this.api.cancelTargeting();
    });

    if (!this.isMobile) {
      this.scene.input.mouse!.disableContextMenu();
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (pointer.button === 0 && this.scene.input.pointer1?.isDown && this.scene.input.pointer2?.isDown) {
      this.clearLongPress();
      this.leftDown = null;
      this.pendingButton = null;
      const p1 = this.scene.input.pointer1;
      const p2 = this.scene.input.pointer2;
      if (p1 && p2) {
        this.pinchDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      }
      return;
    }

    this.pendingButton = pointer.button;
    if (pointer.button === 0) {
      if (this.api.targetingAction()) {
        this.handleTargetingClick(pointer);
        return;
      }
      this.leftDown = {
        sx: pointer.x, sy: pointer.y,
        wx: pointer.worldX, wy: pointer.worldY,
        camX: this.scene.cameras.main.scrollX, camY: this.scene.cameras.main.scrollY,
      };
      this.isPanning = false;
      this.isLongPressSelect = false;

      if (this.isMobile) {
        this.clearLongPress();
        const wx = pointer.worldX;
        const wy = pointer.worldY;
        this.longPressTimer = window.setTimeout(() => {
          this.longPressTimer = null;
          this.isLongPressSelect = true;
          this.isPanning = false;
          this.leftDown = null;
          this.dragStart = { wx, wy };
          this.isDragging = true;
          this.dragRect = null;
        }, 500);
      }
    } else if (pointer.button === 2) {
      this.dragStart = { wx: pointer.worldX, wy: pointer.worldY };
      this.isDragging = false;
      this.dragRect = null;
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (this.scene.input.pointer1?.isDown && this.scene.input.pointer2?.isDown && this.pinchDist > 0) {
      const p1 = this.scene.input.pointer1;
      const p2 = this.scene.input.pointer2;
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      this.scene.cameras.main.setZoom(
        Phaser.Math.Clamp(this.scene.cameras.main.zoom * (dist / this.pinchDist), 0.2, 6),
      );
      this.pinchDist = dist;
      return;
    }

    const dragThreshold = this.isMobile ? 12 : 5;

    if (this.dragStart && (this.pendingButton === 2 || this.isLongPressSelect)) {
      if (!this.isDragging) {
        const dx = pointer.worldX - this.dragStart.wx;
        const dy = pointer.worldY - this.dragStart.wy;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this.isDragging = true;
      }
      if (this.isDragging) {
        this.dragRect = { x1: this.dragStart.wx, y1: this.dragStart.wy, x2: pointer.worldX, y2: pointer.worldY };
        this.api.overlays.drawSelectionRect(this.dragRect);
      }
      return;
    }

    if (this.leftDown && this.pendingButton === 0 && !this.api.targetingAction()) {
      const dx = Math.abs(pointer.x - this.leftDown.sx);
      const dy = Math.abs(pointer.y - this.leftDown.sy);
      if (this.isMobile && (dx > 8 || dy > 8)) this.clearLongPress();
      if (!this.isPanning && (dx > dragThreshold || dy > dragThreshold)) this.isPanning = true;
      if (this.isPanning) {
        const cam = this.scene.cameras.main;
        cam.scrollX = this.leftDown.camX + (this.leftDown.sx - pointer.x) / cam.zoom;
        cam.scrollY = this.leftDown.camY + (this.leftDown.sy - pointer.y) / cam.zoom;
      }
    }

    if (this.api.targetingAction()) {
      this.api.overlays.drawTargetingHover(pointer.worldX, pointer.worldY, this.api.targetingAction(), this.api.gameState());
    }
  }

  private onPointerUp() {
    this.clearLongPress();
    this.pinchDist = 0;

    if (this.isLongPressSelect) {
      if (this.isDragging && this.dragRect) this.finishDragSelect();
      this.isLongPressSelect = false;
      this.dragStart = null;
      this.isDragging = false;
      this.dragRect = null;
      this.api.overlays.clearSelectionRect();
      this.pendingButton = null;
      return;
    }

    if (this.pendingButton === 0) {
      if (this.leftDown && !this.isPanning && !this.api.targetingAction()) {
        const tileX = Math.floor(this.leftDown.wx / TILE_SIZE);
        const tileY = Math.floor(this.leftDown.wy / TILE_SIZE);
        const entity = this.api.entityAt(tileX, tileY);
        if (entity && entity.ownerId === this.api.playerId()) {
          if (this.shiftKey.isDown) {
            if (this.api.selectedIds().has(entity.id)) {
              const next = this.api.selectedIds();
              next.delete(entity.id);
              this.api.setSelectedIds(next);
            } else {
              const next = new Set(this.api.selectedIds());
              next.add(entity.id);
              this.api.setSelectedIds(next);
            }
          } else {
            this.api.setSelectedIds(new Set([entity.id]));
          }
        } else {
          this.api.setSelectedIds(new Set());
        }
        this.api.updateHighlights();
        this.api.onSelectionChanged.next([...this.api.selectedIds()]);
      }
      this.leftDown = null;
      this.isPanning = false;
    }

    if (this.pendingButton === 2) {
      if (this.isDragging && this.dragRect) this.finishDragSelect();
      this.dragStart = null;
      this.isDragging = false;
      this.dragRect = null;
      this.api.overlays.clearSelectionRect();
    }

    this.pendingButton = null;
  }

  private handleTargetingClick(pointer: Phaser.Input.Pointer) {
    const tileX = Math.floor(pointer.worldX / TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / TILE_SIZE);
    const gs = this.api.gameState();
    if (!gs) return;
    const { width, height } = gs.map;
    if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) return;

    const entityIds = [...this.api.selectedIds()];
    if (entityIds.length === 0) {
      this.api.cancelTargeting();
      return;
    }

    this.api.onActionRequest.next({ action: this.api.targetingAction()!, entityIds, x: tileX, y: tileY });
    this.api.cancelTargeting();
  }

  private finishDragSelect() {
    const gs = this.api.gameState();
    if (!this.dragRect || !gs) return;
    const minX = Math.min(this.dragRect.x1, this.dragRect.x2);
    const minY = Math.min(this.dragRect.y1, this.dragRect.y2);
    const maxX = Math.max(this.dragRect.x1, this.dragRect.x2);
    const maxY = Math.max(this.dragRect.y1, this.dragRect.y2);

    const newSelected = new Set<string>();
    for (const [id, entity] of gs.map.entities) {
      if (entity.ownerId !== this.api.playerId()) continue;
      const ex = entity.x * TILE_SIZE + TILE_SIZE / 2;
      const ey = entity.y * TILE_SIZE + TILE_SIZE / 2;
      if (ex >= minX && ex <= maxX && ey >= minY && ey <= maxY) newSelected.add(id);
    }
    this.api.setSelectedIds(newSelected);
    this.api.updateHighlights();
    this.api.onSelectionChanged.next([...this.api.selectedIds()]);
  }

  private clearLongPress() {
    if (this.longPressTimer !== null) {
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  destroy() {
    this.scene.input.off('pointerdown');
    this.scene.input.off('pointermove');
    this.scene.input.off('pointerup');
    this.scene.input.off('wheel');
    this.clearLongPress();
  }
}
