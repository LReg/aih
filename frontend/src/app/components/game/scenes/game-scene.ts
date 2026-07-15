import Phaser from 'phaser';
import { Subject } from 'rxjs';
import { GameState, GameStateDiff, StateUpdate, TileType, TERRAIN_COLORS, Entity, isOverridable, Effect } from '../../../types/game.types';
import { TILE_SIZE } from './texture-generator';
import { EntityManager } from './entity-manager';
import { OverlayRenderer } from './overlay-renderer';
import { InputHandler, GameSceneAPI } from './input-handler';
import { getSpreadPositions } from './get-spread-positions';
import { perfStart, perfEnd, perfInit, perfFrame } from './perf';

export class GameScene extends Phaser.Scene {
  readonly overlays = new OverlayRenderer(this);
  readonly onSelectionChanged = new Subject<string[]>();
  readonly onActionRequest = new Subject<{ action: string; entityIds: string[]; x: number; y: number }>();
  readonly onTargetingChanged = new Subject<'walk' | 'attack' | null>();

  private entityManager!: EntityManager;
  private inputHandler!: InputHandler;
  private fogGraphics!: Phaser.GameObjects.Graphics;
  private renderStart = 0;
  private renderTimeLog = 0;
  private hasCentered = false;
  private gridDrawn = false;
  private tileLookup: TileType[][] = [];

  gameState: GameState | null = null;
  selectedIds = new Set<string>();
  playerId = '';
  targetingAction: 'walk' | 'attack' | null = null;

  private entitiesMap = new Map<string, Entity>();
  private entitySpatialMap = new Map<string, string>();
  private darknessRange = 0;
  private fogVisibleIds = new Set<string>();

  private fogDirty = false;
  private fogNeedsClear = false;
  private fogColorBatches: Array<{ color: number; rects: Array<{ x: number; y: number; w: number }> }> = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    perfInit();
    this.cameras.main.setZoom(0.3);
    this.fogGraphics = this.add.graphics().setDepth(1);
    this.overlays.create();

    this.events.on('prerender', this.onPreRender, this);
    this.events.on('render', this.onPostRender, this);

    this.entityManager = new EntityManager(this);
    this.inputHandler = new InputHandler(this, this.apiHandle);
    this.inputHandler.setup();
  }

  setPlayerId(id: string) { this.playerId = id; }

  startTargeting(action: 'walk' | 'attack') {
    this.targetingAction = action;
    const label = action === 'walk' ? 'Click map to move' : 'Click map to attack';
    this.overlays.showTargetingLabel(label);
    const ptr = this.input.activePointer;
    this.overlays.drawTargetingHover(ptr.worldX, ptr.worldY, action, this.gameState);
    const tileX = Math.floor(ptr.worldX / TILE_SIZE);
    const tileY = Math.floor(ptr.worldY / TILE_SIZE);
    const positions = this.getSpreadPreview(tileX, tileY);
    const color = action === 'attack' ? 0xff3333 : 0x33ff33;
    this.overlays.drawSpreadPreview(positions, color);
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

  get entityCount(): number { return this.entitiesMap.size; }

  getEntity(id: string): Entity | undefined {
    return this.entitiesMap.get(id);
  }

  getAllPlayerEntityIds(playerId: string): string[] {
    const ids: string[] = [];
    for (const [id, e] of this.entitiesMap) {
      if (e.ownerId === playerId) ids.push(id);
    }
    return ids;
  }

  countPlayerBarracks(playerId: string): number {
    let count = 0;
    for (const entity of this.entitiesMap.values()) {
      if (entity.ownerId === playerId && entity.type === 'barracks') count++;
    }
    return count;
  }

  countPlayerSoldiers(playerId: string): number {
    let count = 0;
    for (const entity of this.entitiesMap.values()) {
      if (entity.ownerId === playerId && entity.type === 'soldier') count++;
    }
    return count;
  }

  override update(time: number, delta: number) {
    perfStart('gameScene.update');
    this.renderFog();
    this.entityManager.setFogVisibleIds(this.darknessRange > 0 ? this.fogVisibleIds : null);
    this.entityManager.update(delta);
    this.overlays.setLod(this.entityManager.isLod);
    const visible = this.darknessRange > 0 ? this.fogVisibleIds : undefined;
    this.overlays.updatePositions((id) => {
      return this.entityManager.getEntityPosition(id);
    }, visible);
    perfEnd('gameScene.update');
    perfFrame(this, this.renderTimeLog, this.entityManager.spriteCount, this.entityManager.dotCount);
  }

  private onPreRender() {
    this.renderStart = performance.now();
  }

  private onPostRender() {
    this.renderTimeLog = performance.now() - this.renderStart;
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
    if (!this.entityManager) return;
    perfStart('updateFromState');
    let effects: Effect[] | undefined;
    if ('diff' in update && update.diff) {
      const diff = update as GameStateDiff;
      effects = diff.effects;
      this.applyDiff(diff);
      if (this.gameState) {
        this.entityManager.reconcileIncremental(
          new Map(diff.changed), diff.removed,
          this.gameState.playerColors, this.gameState.tickRateMs,
        );
      }
    } else {
      const state = update as GameState;
      effects = state.effects;
      this.applyFull(state);
      if (this.gameState) {
        this.entityManager.reconcileFull(
          this.entitiesMap,
          this.gameState.playerColors, this.gameState.tickRateMs,
        );
      }
    }

    if (effects && effects.length > 0) {
      this.entityManager.applyEffects(effects, this.gameState?.tickRateMs || 500);
    }

    if (this.gameState) {
      this.cleanSelection();
      this.computeFogData();
      this.overlays.updateAll(this.entitiesMap, this.selectedIds, this.playerId, this.darknessRange > 0 ? this.fogVisibleIds : undefined);
    }

    if (!this.hasCentered && this.gameState) this.centerOnPlayer();
    perfEnd('updateFromState');
  }

  private applyFull(state: GameState) {
    this.gameState = state;
    this.darknessRange = state.darknessRange || 0;
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
    this.buildTileLookup(state);
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

  private buildTileLookup(state: GameState) {
    const { width, height, tiles } = state.map;
    this.tileLookup = new Array(width);
    for (let x = 0; x < width; x++) this.tileLookup[x] = new Array(height).fill(undefined);
    for (const [key, tile] of tiles) {
      const [x, y] = key.split(',').map(Number);
      this.tileLookup[x][y] = tile.terrain;
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
      return e && e.type === 'soldier' && isOverridable(e.state.status);
    });
    const count = soldiers.length;
    if (count === 0) return [];

    const isAvailable = (x: number, y: number) => {
      const id = this.entitySpatialMap.get(`${x},${y}`);
      if (!id) return true;
      const e = this.entitiesMap.get(id);
      if (!e || e.ownerId === this.playerId) return false;
      if (this.darknessRange > 0 && !this.fogVisibleIds.has(id)) return true;
      if (this.targetingAction === 'walk') return false;
      return true;
    };

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

  updateHighlights() {
    this.overlays.updateAll(this.entitiesMap, this.selectedIds, this.playerId);
  }

  selectAllEntities(playerId: string) {
    const ids: string[] = [];
    for (const [id, e] of this.entitiesMap) {
      if (e.ownerId === playerId) ids.push(id);
    }
    this.selectedIds = new Set(ids);
    this.updateHighlights();
    this.onSelectionChanged.next(ids);
  }

  cancelSelection() {
    this.selectedIds.clear();
    this.overlays.clearSelection();
    this.onSelectionChanged.next([]);
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
    const g = this.add.graphics();
    g.fillStyle(0x3a5f0b, 1);
    g.fillRect(0, 0, width * TILE_SIZE, height * TILE_SIZE);

    for (const [key, tile] of tiles) {
      const [x, y] = key.split(',').map(Number);
      g.fillStyle(TERRAIN_COLORS[tile.terrain], 1);
      g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    g.lineStyle(1, 0x2d4a08, 0.3);
    for (let x = 0; x <= width; x++) {
      g.moveTo(x * TILE_SIZE, 0);
      g.lineTo(x * TILE_SIZE, height * TILE_SIZE);
    }
    for (let y = 0; y <= height; y++) {
      g.moveTo(0, y * TILE_SIZE);
      g.lineTo(width * TILE_SIZE, y * TILE_SIZE);
    }
    g.strokePath();

    g.generateTexture('tilemap', width * TILE_SIZE, height * TILE_SIZE);
    this.add.image(0, 0, 'tilemap').setOrigin(0, 0).setDepth(0);
    g.destroy();
  }

  private computeFogData() {
    perfStart('computeFogData');
    if (!this.gameState) { perfEnd('computeFogData'); return; }
    const friends: { x: number; y: number }[] = [];
    for (const e of this.entitiesMap.values()) {
      if (e.ownerId === this.playerId) friends.push({ x: e.x, y: e.y });
    }

    if (this.darknessRange <= 0) {
      this.fogGraphics.clear();
      this.fogColorBatches = [];
      this.fogDirty = false;
      this.fogNeedsClear = false;
      this.fogVisibleIds = new Set(this.entitiesMap.keys());
      this.entityManager.setFogVisibleIds(this.fogVisibleIds);
      this.entityManager.updateVisibility(this.fogVisibleIds);
      perfEnd('computeFogData');
      return;
    }

    if (friends.length === 0) {
      this.fogGraphics.clear();
      this.fogColorBatches = [];
      this.fogDirty = false;
      this.fogNeedsClear = false;
      this.fogVisibleIds = new Set(this.entitiesMap.keys());
      this.entityManager.setFogVisibleIds(this.fogVisibleIds);
      this.entityManager.updateVisibility(this.fogVisibleIds);
      perfEnd('computeFogData');
      return;
    }

    const range = this.darknessRange;
    const rangeSq = range * range;
    const { width, height } = this.gameState.map;
    const lookup = this.tileLookup;
    const grassColor = TERRAIN_COLORS[TileType.Grass];

    // Mark visible tiles per row using byte mask (per-friend circle, no tuples)
    const rowMarks: (Uint8Array | undefined)[] = new Array(height);
    for (const f of friends) {
      for (let dy = -range; dy <= range; dy++) {
        const y = f.y + dy;
        if (y < 0 || y >= height) continue;
        const halfWidth = Math.floor(Math.sqrt(rangeSq - dy * dy));
        const minX = Math.max(0, f.x - halfWidth);
        const maxX = Math.min(width - 1, f.x + halfWidth);
        let mask = rowMarks[y];
        if (!mask) { mask = new Uint8Array(width); rowMarks[y] = mask; }
        mask.fill(1, minX, maxX + 1);
      }
    }

    // Scan rows → horizontal runs grouped by terrain color
    const byColor = new Map<number, Array<{ x: number; y: number; w: number }>>();
    const addRect = (color: number, x: number, y: number, w: number) => {
      let list = byColor.get(color);
      if (!list) { list = []; byColor.set(color, list); }
      list.push({ x, y, w });
    };
    for (let y = 0; y < height; y++) {
      const mask = rowMarks[y];
      if (!mask) continue;
      let runStart = -1;
      let runColor = 0;
      for (let x = 0; x < width; x++) {
        if (mask[x]) {
          const t = lookup[x]?.[y];
          const c = t !== undefined ? TERRAIN_COLORS[t] : grassColor;
          if (runStart < 0) { runStart = x; runColor = c; }
          else if (c !== runColor) {
            addRect(runColor, runStart, y, x - runStart);
            runStart = x;
            runColor = c;
          }
        } else if (runStart >= 0) {
          addRect(runColor, runStart, y, x - runStart);
          runStart = -1;
        }
      }
      if (runStart >= 0) addRect(runColor, runStart, y, width - runStart);
    }

    this.fogColorBatches = [];
    for (const [color, rects] of byColor) {
      this.fogColorBatches.push({ color, rects });
    }
    this.fogDirty = true;
    this.fogNeedsClear = false;

    this.fogVisibleIds.clear();
    for (const e of this.entitiesMap.values()) {
      if (e.ownerId === this.playerId) { this.fogVisibleIds.add(e.id); continue; }
      if (rowMarks[e.y]?.[e.x]) this.fogVisibleIds.add(e.id);
    }
    this.entityManager.setFogVisibleIds(this.fogVisibleIds);
    this.entityManager.updateVisibility(this.fogVisibleIds);
    perfEnd('computeFogData');
  }

  private renderFog() {
    perfStart('renderFog');
    if (this.fogNeedsClear) {
      this.fogGraphics.clear();
      this.fogVisibleIds.clear();
      this.fogNeedsClear = false;
      this.entityManager.showAll();
      perfEnd('renderFog');
      return;
    }
    if (!this.fogDirty) { perfEnd('renderFog'); return; }

    const { width, height } = this.gameState!.map;
    this.fogGraphics.clear();
    this.fogGraphics.fillStyle(0x1a1a1a, 1);
    this.fogGraphics.fillRect(0, 0, width * TILE_SIZE, height * TILE_SIZE);

    for (const batch of this.fogColorBatches) {
      this.fogGraphics.fillStyle(batch.color, 1);
      for (const rect of batch.rects) {
        this.fogGraphics.fillRect(rect.x * TILE_SIZE, rect.y * TILE_SIZE, rect.w * TILE_SIZE, TILE_SIZE);
      }
    }

    this.fogDirty = false;
    this.fogColorBatches = [];
    this.entityManager.updateVisibility(this.fogVisibleIds);
    perfEnd('renderFog');
  }
}
