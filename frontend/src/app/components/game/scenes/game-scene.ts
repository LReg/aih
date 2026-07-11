import Phaser from 'phaser';
import { Subject } from 'rxjs';
import { GameState, GameStateDiff, StateUpdate, TileType, Entity } from '../../../types/game.types';
import { TILE_SIZE } from './texture-generator';
import { EntityManager } from './entity-manager';
import { OverlayRenderer } from './overlay-renderer';
import { InputHandler, GameSceneAPI } from './input-handler';

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

  override update() {
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
      updateHighlights: () => this.overlays.updateAll(this.gameState, this.selectedIds, this.playerId),
      cancelTargeting: () => this.cancelTargeting(),
    };
  }

  updateFromState(update: StateUpdate) {
    if ('diff' in update && update.diff) {
      this.applyDiff(update);
    } else {
      this.applyFull(update as GameState);
    }

    if (this.gameState) {
      this.entityManager.reconcile(this.gameState, this.gameState.tickRateMs);
      this.cleanSelection();
      this.overlays.updateAll(this.gameState, this.selectedIds, this.playerId);
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

    this.gameState.map.entities = [...this.entitiesMap.entries()];
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

  private centerOnPlayer() {
    const state = this.gameState!;
    if (!this.playerId) return;
    for (const [, entity] of state.map.entities) {
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
