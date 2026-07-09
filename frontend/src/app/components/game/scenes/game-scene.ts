import Phaser from 'phaser';
import { Subject } from 'rxjs';
import { GameState, Entity, TileType } from '../../../types/game.types';

const TILE_SIZE = 32;

export class GameScene extends Phaser.Scene {
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private tileGraphics!: Phaser.GameObjects.Graphics;
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private busyGraphics!: Phaser.GameObjects.Graphics;
  private attackEyeGraphics!: Phaser.GameObjects.Graphics;
  private selectionRectGraphics!: Phaser.GameObjects.Graphics;
  private targetingGraphics!: Phaser.GameObjects.Graphics;
  private targetingLabel!: Phaser.GameObjects.Text;

  private _gameState: GameState | null = null;
  private selectedIds = new Set<string>();
  private targetingAction: 'walk' | 'attack' | null = null;
  private dragStart: { wx: number; wy: number } | null = null;
  private dragRect: { x1: number; y1: number; x2: number; y2: number } | null = null;
  private isDragging = false;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private leftDown: { sx: number; sy: number; wx: number; wy: number; camX: number; camY: number } | null = null;
  private isPanning = false;
  private pendingButton: number | null = null;
  private playerId = '';
  private hasCentered = false;

  onSelectionChanged = new Subject<string[]>();
  onActionRequest = new Subject<{ action: string; entityIds: string[]; x: number; y: number }>();
  onTargetingChanged = new Subject<'walk' | 'attack' | null>();

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.tileGraphics = this.add.graphics().setDepth(0);
    this.targetingGraphics = this.add.graphics().setDepth(1);
    this.highlightGraphics = this.add.graphics().setDepth(2);
    this.busyGraphics = this.add.graphics().setDepth(3);
    this.attackEyeGraphics = this.add.graphics().setDepth(4);
    this.selectionRectGraphics = this.add.graphics().setDepth(3);

    this.drawGrid();
    this.setupCamera();
    this.setupInput();

    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.targetingLabel = this.add.text(this.cameras.main.width / 2, 12, '', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#00000099',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000).setVisible(false);
  }

  // ---- public API ----

  setPlayerId(id: string) { this.playerId = id; }

  startTargeting(action: 'walk' | 'attack') {
    this.targetingAction = action;
    const label = action === 'walk' ? 'Click map to move' : 'Click map to attack';
    this.targetingLabel.setText(label).setVisible(true);
    this.onTargetingChanged.next(action);
  }

  cancelTargeting() {
    this.targetingAction = null;
    this.targetingLabel.setVisible(false);
    this.targetingGraphics.clear();
    this.onTargetingChanged.next(null);
  }

  get selectedEntityIds(): string[] { return [...this.selectedIds]; }
  get isTargeting(): boolean { return this.targetingAction !== null; }
  getGameState(): GameState | null { return this._gameState; }

  // ---- state sync ----

  updateFromState(state: GameState) {
    this._gameState = state;
    const w = state.map.width * TILE_SIZE;
    const h = state.map.height * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, w, h);
    this.drawGrid();
    this.reconcileEntities(state);
    this.cleanSelection(state);
    this.updateHighlights();
    this.updateBusyIndicators();
    this.updateAttackEyes();
    if (!this.hasCentered) this.centerOnPlayer();
  }

  private centerOnPlayer() {
    if (!this._gameState || !this.playerId) return;
    for (const [, entity] of this._gameState.map.entities) {
      if (entity.ownerId === this.playerId && entity.type === 'soldier') {
        const cam = this.cameras.main;
        cam.scrollX = entity.x * TILE_SIZE + TILE_SIZE / 2 - cam.width / 2 / cam.zoom;
        cam.scrollY = entity.y * TILE_SIZE + TILE_SIZE / 2 - cam.height / 2 / cam.zoom;
        this.hasCentered = true;
        return;
      }
    }
  }

  private reconcileEntities(state: GameState) {
    const incoming = new Map(state.map.entities);
    for (const [id, entity] of incoming) {
      const existing = this.sprites.get(id);
      if (existing) {
        existing.setPosition(entity.x * TILE_SIZE + TILE_SIZE / 2, entity.y * TILE_SIZE + TILE_SIZE / 2);
      } else {
        this.createSprite(entity, state.players);
      }
    }
    for (const [id, sprite] of this.sprites) {
      if (!incoming.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }

  private cleanSelection(state: GameState) {
    const ids = new Set(state.map.entities.map(([id]) => id));
    for (const id of this.selectedIds) {
      if (!ids.has(id)) this.selectedIds.delete(id);
    }
    if (state.state === 'finished') {
      this.selectedIds.clear();
      this.cancelTargeting();
    }
  }

  private createSprite(entity: Entity, players: string[]) {
    const x = entity.x * TILE_SIZE + TILE_SIZE / 2;
    const y = entity.y * TILE_SIZE + TILE_SIZE / 2;
    const color = this.playerColor(entity.ownerId, players);
    const key = this.makeTexture(color, entity.type);
    const sprite = this.add.sprite(x, y, key);
    sprite.setData('entityId', entity.id);
    this.sprites.set(entity.id, sprite);
  }

  private playerColor(ownerId: string, _players: string[]): number {
    return ownerId === this.playerId ? 0x3388ff : 0xff4444;
  }

  private makeTexture(color: number, type: string): string {
    const key = `${type}_${color}`;
    if (this.textures.exists(key)) return key;

    const S = TILE_SIZE - 4;
    const cx = S / 2;
    const hex = `#${color.toString(16).padStart(6, '0')}`;
    const r = Math.min(255, ((color >> 16) & 0xff) + 60);
    const g = Math.min(255, ((color >> 8) & 0xff) + 60);
    const b = Math.min(255, (color & 0xff) + 60);
    const light = `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;

    const canvas = this.textures.createCanvas(key, S, S);
    if (!canvas) return '';
    const ctx = canvas.getContext();

    if (type === 'soldier') {
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.arc(cx, S - 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, S - 20, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(cx, S - 10, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.moveTo(2, S - 8);
      ctx.lineTo(cx, 2);
      ctx.lineTo(S - 2, S - 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(4, S - 8, S - 8, 6);
      ctx.fillStyle = light;
      ctx.fillRect(cx - 3, S - 16, 6, 6);
    }

    canvas.refresh();
    return key;
  }

  // ---- selection ----

  private updateHighlights() {
    this.highlightGraphics.clear();
    if (!this._gameState) return;
    const entities = new Map(this._gameState.map.entities);
    for (const id of this.selectedIds) {
      const e = entities.get(id);
      if (!e) continue;
      const cx = e.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = e.y * TILE_SIZE + TILE_SIZE / 2;
      this.highlightGraphics.lineStyle(2, 0xffff00, 0.9);
      this.highlightGraphics.strokeCircle(cx, cy, TILE_SIZE / 2 + 2);
    }
  }

  private updateBusyIndicators() {
    this.busyGraphics.clear();
    if (!this._gameState || !this.playerId) return;
    for (const [, entity] of this._gameState.map.entities) {
      if (entity.ownerId !== this.playerId) continue;
      if (entity.type !== 'soldier' || entity.state.status !== 'building-barracks') continue;
      const cx = entity.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = entity.y * TILE_SIZE + TILE_SIZE / 2;
      this.busyGraphics.fillStyle(0xff8800, 0.9);
      this.busyGraphics.fillCircle(cx, cy, 4);
    }
  }

  private updateAttackEyes() {
    this.attackEyeGraphics.clear();
    if (!this._gameState) return;
    for (const [, entity] of this._gameState.map.entities) {
      if (entity.type !== 'soldier') continue;
      const s = entity.state.status;
      if (s !== 'attacking') continue;
      const px = entity.x * TILE_SIZE + TILE_SIZE / 2;
      const py = entity.y * TILE_SIZE + TILE_SIZE / 2;
      this.attackEyeGraphics.fillStyle(0xff0000, 1);
      this.attackEyeGraphics.fillCircle(px - 2, py - 7, 1.5);
      this.attackEyeGraphics.fillCircle(px + 2, py - 7, 1.5);
    }
  }

  private setupInput() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.pendingButton = pointer.button;
      if (pointer.button === 0) {
        if (this.targetingAction) {
          this.handleTargetingClick(pointer);
          return;
        }
        this.leftDown = {
          sx: pointer.x, sy: pointer.y,
          wx: pointer.worldX, wy: pointer.worldY,
          camX: this.cameras.main.scrollX, camY: this.cameras.main.scrollY,
        };
        this.isPanning = false;
      } else if (pointer.button === 2) {
        this.dragStart = { wx: pointer.worldX, wy: pointer.worldY };
        this.isDragging = false;
        this.dragRect = null;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.dragStart && this.pendingButton === 2) {
        if (!this.isDragging) {
          const dx = pointer.worldX - this.dragStart.wx;
          const dy = pointer.worldY - this.dragStart.wy;
          if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this.isDragging = true;
        }
        if (this.isDragging) {
          this.dragRect = { x1: this.dragStart.wx, y1: this.dragStart.wy, x2: pointer.worldX, y2: pointer.worldY };
          this.drawSelectionRect(this.dragRect);
        }
      }
      if (this.leftDown && this.pendingButton === 0 && !this.targetingAction) {
        const dx = Math.abs(pointer.x - this.leftDown.sx);
        const dy = Math.abs(pointer.y - this.leftDown.sy);
        if (!this.isPanning && (dx > 5 || dy > 5)) this.isPanning = true;
        if (this.isPanning) {
          const cam = this.cameras.main;
          cam.scrollX = this.leftDown.camX + (this.leftDown.sx - pointer.x) / cam.zoom;
          cam.scrollY = this.leftDown.camY + (this.leftDown.sy - pointer.y) / cam.zoom;
        }
      }
      if (this.targetingAction) this.drawTargetingHover(pointer);
    });

    this.input.on('pointerup', () => {
      if (this.pendingButton === 0) {
        if (this.leftDown && !this.isPanning && !this.targetingAction) {
          const tileX = Math.floor(this.leftDown.wx / TILE_SIZE);
          const tileY = Math.floor(this.leftDown.wy / TILE_SIZE);
          const entity = this.entityAt(tileX, tileY);
          if (entity && entity.ownerId === this.playerId) {
            if (this.shiftKey.isDown) {
              if (this.selectedIds.has(entity.id)) this.selectedIds.delete(entity.id);
              else this.selectedIds.add(entity.id);
            } else {
              this.selectedIds = new Set([entity.id]);
            }
          } else {
            this.selectedIds.clear();
          }
          this.updateHighlights();
          this.onSelectionChanged.next([...this.selectedIds]);
        }
        this.leftDown = null;
        this.isPanning = false;
      }
      if (this.pendingButton === 2) {
        if (this.isDragging && this.dragRect) this.finishDragSelect();
        this.dragStart = null;
        this.isDragging = false;
        this.dragRect = null;
        this.selectionRectGraphics.clear();
      }
      this.pendingButton = null;
    });

    this.input.mouse!.disableContextMenu();
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.targetingAction) this.cancelTargeting();
    });
  }

  private handleTargetingClick(pointer: Phaser.Input.Pointer) {
    const tileX = Math.floor(pointer.worldX / TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / TILE_SIZE);
    if (!this._gameState) return;
    const { width, height } = this._gameState.map;
    if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) {
      console.log(`[GameScene] targeting click out of bounds: (${tileX},${tileY})`);
      return;
    }

    const entityIds = [...this.selectedIds];
    if (entityIds.length === 0) {
      console.log('[GameScene] targeting click but no entities selected');
      this.cancelTargeting();
      return;
    }
    console.log(`[GameScene] targeting click: action=${this.targetingAction} entities=${entityIds.length} tile=(${tileX},${tileY})`);
    this.onActionRequest.next({ action: this.targetingAction!, entityIds, x: tileX, y: tileY });
    this.cancelTargeting();
  }

  private entityAt(tileX: number, tileY: number): Entity | null {
    if (!this._gameState) return null;
    for (const [, entity] of this._gameState.map.entities) {
      if (entity.x === tileX && entity.y === tileY) return entity;
    }
    return null;
  }

  // ---- drag select ----

  private drawSelectionRect(r: { x1: number; y1: number; x2: number; y2: number }) {
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

  private finishDragSelect() {
    if (!this.dragRect || !this._gameState) return;
    const minX = Math.min(this.dragRect.x1, this.dragRect.x2);
    const minY = Math.min(this.dragRect.y1, this.dragRect.y2);
    const maxX = Math.max(this.dragRect.x1, this.dragRect.x2);
    const maxY = Math.max(this.dragRect.y1, this.dragRect.y2);

    const newSelected = new Set<string>();
    for (const [id, entity] of this._gameState.map.entities) {
      if (entity.ownerId !== this.playerId) continue;
      const ex = entity.x * TILE_SIZE + TILE_SIZE / 2;
      const ey = entity.y * TILE_SIZE + TILE_SIZE / 2;
      if (ex >= minX && ex <= maxX && ey >= minY && ey <= maxY) newSelected.add(id);
    }
    this.selectedIds = newSelected;
    this.updateHighlights();
    this.onSelectionChanged.next([...this.selectedIds]);
  }

  // ---- targeting hover ----

  private drawTargetingHover(pointer: Phaser.Input.Pointer) {
    this.targetingGraphics.clear();
    if (!this._gameState) return;
    const tileX = Math.floor(pointer.worldX / TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / TILE_SIZE);
    const { width, height } = this._gameState.map;
    if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) return;

    const color = this.targetingAction === 'attack' ? 0xff3333 : 0x33ff33;
    this.targetingGraphics.fillStyle(color, 0.25);
    this.targetingGraphics.fillRect(tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    this.targetingGraphics.lineStyle(2, color, 0.8);
    this.targetingGraphics.strokeRect(tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }

  // ---- camera ----

  private setupCamera() {
    this.cameras.main.setZoom(1);

    this.input.on('wheel', (_pointer: unknown, _gx: unknown, _gy: unknown, deltaY: number) => {
      const zoom = Phaser.Math.Clamp(this.cameras.main.zoom - deltaY * 0.002, 0.1, 6);
      this.cameras.main.setZoom(zoom);
    });
  }

  // ---- helpers ----

  private drawGrid() {
    if (!this._gameState) return;
    const { width, height, tiles } = this._gameState.map;
    this.tileGraphics.clear();
    this.tileGraphics.fillStyle(0x3a5f0b, 1);
    this.tileGraphics.fillRect(0, 0, width * TILE_SIZE, height * TILE_SIZE);

    for (const [key, tile] of tiles) {
      const [x, y] = key.split(',').map(Number);
      const color = tile.terrain === TileType.Water ? 0x1a5276
        : tile.terrain === TileType.Mountain ? 0x5d4037
        : 0x3a5f0b;
      this.tileGraphics.fillStyle(color, 1);
      this.tileGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    this.tileGraphics.lineStyle(1, 0x2d4a08, 0.3);
    for (let x = 0; x <= width; x++) {
      this.tileGraphics.moveTo(x * TILE_SIZE, 0);
      this.tileGraphics.lineTo(x * TILE_SIZE, height * TILE_SIZE);
    }
    for (let y = 0; y <= height; y++) {
      this.tileGraphics.moveTo(0, y * TILE_SIZE);
      this.tileGraphics.lineTo(width * TILE_SIZE, y * TILE_SIZE);
    }
    this.tileGraphics.strokePath();
  }
}
