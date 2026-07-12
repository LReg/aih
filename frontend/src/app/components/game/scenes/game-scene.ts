import Phaser from 'phaser';
import { Subject } from 'rxjs';
import { GameState, GameStateDiff, StateUpdate, TileType, Entity } from '../../../types/game.types';
import { TILE_SIZE } from './texture-generator';
import { EntityManager } from './entity-manager';
import { OverlayRenderer } from './overlay-renderer';
import { InputHandler, GameSceneAPI } from './input-handler';
import { getSpreadPositions } from './get-spread-positions';

export class GameScene extends Phaser.Scene {
  readonly overlays = new OverlayRenderer(this);
  readonly onSelectionChanged = new Subject<string[]>();
  readonly onActionRequest = new Subject<{ action: string; entityIds: string[]; x: number; y: number }>();
  readonly onTargetingChanged = new Subject<'walk' | 'attack' | null>();

  private entityManager!: EntityManager;
  private inputHandler!: InputHandler;
  private tileGraphics!: Phaser.GameObjects.Graphics;
  private hasCentered = false;
  private gridDrawn = false;

  gameState: GameState | null = null;
  selectedIds = new Set<string>();
  playerId = '';
  targetingAction: 'walk' | 'attack' | null = null;

  private entitiesMap = new Map<string, Entity>();
  private entitySpatialMap = new Map<string, string>();

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.tileGraphics = this.add.graphics().setDepth(0);
    this.overlays.create();

    this.entityManager = new EntityManager(this);
    this.inputHandler = new InputHandler(this, this.apiHandle);
    this.inputHandler.setup();
  }

  setPlayerId(id: string) { this.playerId = id; }

  startTargeting(action: 'walk' | 'attack') {
    this.targetingAction = action;
    const label = action === 'walk' ? 'Click map to move' : 'Click map to attack';
    this.overlays.showTargetingLabel(label);
    this.onTargetingChanged.next(action);
  }

  cancelTargeting() {
    this.targetingAction = null;
    this.overlays.showTargetingLabel(null);
    this.overlays.clearTargeting();
    this.onTargetingChanged.next(null);
  }

  get selectedEntityIds(): string[] { return [...this.selectedIds]; }
  get isTargeting(): boolean { return this.targetingAction !== null; }
  getGameState(): GameState | null { return this.gameState; }

  getEntity(id: string): Entity | undefined {
    return this.entitiesMap.get(id);
  }

  override update(time: number, delta: number) {
    this.entityManager.update(delta);
    this.overlays.updatePositions((id) => {
      const sprite = this.entityManager.getSprite(id);
      if (!sprite) return undefined;
      return { x: sprite.x, y: sprite.y };
    });
  }

  get apiHandle(): GameSceneAPI {
    return {
      gameState: () => this.gameState,
      selectedIds: () => this.selectedIds,
      setSelectedIds: (v) => { this.selectedIds = v; },
      playerId: () => this.playerId,
      targetingAction: () => this.targetingAction,
      overlays: this.overlays,
      onSelectionChanged: this.onSelectionChanged,
      onActionRequest: this.onActionRequest,
      onTargetingChanged: this.onTargetingChanged,
      entityAt: (tx, ty) => this.entityAt(tx, ty),
      updateHighlights: () => this.overlays.updateAll(this.entitiesMap, this.selectedIds, this.playerId),
      cancelTargeting: () => this.cancelTargeting(),
      entitiesInRect: (wxMin, wyMin, wxMax, wyMax) => this.entitiesInRect(wxMin, wyMin, wxMax, wyMax),
      getSpreadPreview: (tileX, tileY) => this.getSpreadPreview(tileX, tileY),
    };
  }

  updateFromState(update: StateUpdate) {
    if ('diff' in update && update.diff) {
      const diff = update as GameStateDiff;
      this.applyDiff(diff);
      if (this.gameState) {
        this.entityManager.reconcileIncremental(
          new Map(diff.changed), diff.removed,
          this.gameState.playerColors, this.gameState.tickRateMs,
        );
      }
    } else {
      this.applyFull(update as GameState);
      if (this.gameState) {
        this.entityManager.reconcileFull(
          this.entitiesMap,
          this.gameState.playerColors, this.gameState.tickRateMs,
        );
      }
    }

    if (this.gameState) {
      this.cleanSelection();
      this.overlays.updateAll(this.entitiesMap, this.selectedIds, this.playerId);
    }

    if (!this.hasCentered && this.gameState) this.centerOnPlayer();
  }

  private applyFull(state: GameState) {
    this.gameState = state;
    const w = state.map.width * TILE_SIZE;
    const h = state.map.height * TILE_SIZE;
    const cam = this.cameras.main;
    const pad = Math.max(cam.width / cam.zoom, cam.height / cam.zoom);
    cam.setBounds(-pad, -pad, w + pad * 2, h + pad * 2);

    if (!this.gridDrawn) {
      this.drawGrid(state);
      this.gridDrawn = true;
    }

    this.entitiesMap = new Map(state.map.entities);
    this.buildSpatialMap();
  }

  private applyDiff(diff: GameStateDiff) {
    if (!this.gameState) return;

    this.gameState.tick = diff.tick;

    for (const id of diff.removed) {
      const e = this.entitiesMap.get(id);
      if (e) this.entitySpatialMap.delete(`${e.x},${e.y}`);
      this.entitiesMap.delete(id);
    }

    for (const [id, entity] of diff.changed) {
      const prev = this.entitiesMap.get(id);
      if (prev) this.entitySpatialMap.delete(`${prev.x},${prev.y}`);
      this.entitiesMap.set(id, entity);
      this.entitySpatialMap.set(`${entity.x},${entity.y}`, id);
    }
  }

  private buildSpatialMap() {
    this.entitySpatialMap.clear();
    for (const [id, entity] of this.entitiesMap) {
      this.entitySpatialMap.set(`${entity.x},${entity.y}`, id);
    }
  }

  entityAt(tileX: number, tileY: number): Entity | null {
    const id = this.entitySpatialMap.get(`${tileX},${tileY}`);
    if (!id) return null;
    return this.entitiesMap.get(id) || null;
  }

  private entitiesInRect(worldMinX: number, worldMinY: number, worldMaxX: number, worldMaxY: number): Entity[] {
    const minTileX = Math.max(0, Math.floor(worldMinX / TILE_SIZE));
    const minTileY = Math.max(0, Math.floor(worldMinY / TILE_SIZE));
    const maxTileX = Math.floor(worldMaxX / TILE_SIZE);
    const maxTileY = Math.floor(worldMaxY / TILE_SIZE);
    if (!this.gameState) return [];
    const clampedMaxTileX = Math.min(maxTileX, this.gameState.map.width - 1);
    const clampedMaxTileY = Math.min(maxTileY, this.gameState.map.height - 1);
    const found: Entity[] = [];
    for (let tx = minTileX; tx <= clampedMaxTileX; tx++) {
      for (let ty = minTileY; ty <= clampedMaxTileY; ty++) {
        const id = this.entitySpatialMap.get(`${tx},${ty}`);
        if (id) {
          const entity = this.entitiesMap.get(id);
          if (entity) found.push(entity);
        }
      }
    }
    return found;
  }

  private getSpreadPreview(tileX: number, tileY: number): { x: number; y: number }[] {
    if (!this.gameState) return [];
    const soldiers = [...this.selectedIds].filter(id => {
      const e = this.entitiesMap.get(id);
      return e && e.type === 'soldier';
    });
    const count = soldiers.length;
    if (count === 0) return [];

    const isAvailable = this.targetingAction === 'attack'
      ? (x: number, y: number) => {
          const id = this.entitySpatialMap.get(`${x},${y}`);
          if (!id) return true;
          const e = this.entitiesMap.get(id);
          return e !== undefined && e.ownerId !== this.playerId;
        }
      : (x: number, y: number) => !this.entitySpatialMap.has(`${x},${y}`);

    return getSpreadPositions(tileX, tileY, count, isAvailable, this.gameState.map.width, this.gameState.map.height);
  }

  private centerOnPlayer() {
    if (!this.playerId) return;
    for (const [, entity] of this.entitiesMap) {
      if (entity.ownerId === this.playerId && entity.type === 'soldier') {
        const cam = this.cameras.main;
        cam.scrollX = entity.x * TILE_SIZE + TILE_SIZE / 2 - cam.width / 2 / cam.zoom;
        cam.scrollY = entity.y * TILE_SIZE + TILE_SIZE / 2 - cam.height / 2 / cam.zoom;
        this.hasCentered = true;
        return;
      }
    }
  }

  private cleanSelection() {
    if (!this.gameState) return;
    for (const id of this.selectedIds) {
      if (!this.entitiesMap.has(id)) this.selectedIds.delete(id);
    }
    if (this.gameState.state === 'finished') {
      this.selectedIds.clear();
      this.cancelTargeting();
    }
  }

  private drawGrid(state: GameState) {
    const { width, height, tiles } = state.map;
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
