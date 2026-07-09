import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { GameDao } from '../dao/game-dao';
import { GameGateway } from './game.gateway';
import { GameMap, createSoldier, createBarracks, findPath, getSpreadPositions, manhattan } from './game-map';
import { Game, QueuedAction } from './game';
import { Gamemode, GAMEMODE_CONFIGS } from './gamemode.config';
import type { GamemodeConfig } from './gamemode.config';
import type { Entity, EntityState } from './game-map';

interface WalkPayload { entityIds: string[]; x: number; y: number }
interface AttackPayload { entityIds: string[]; x: number; y: number }
interface BuildPayload { entityIds: string[] }

@Injectable()
export class GameService {
  private ticks = new Map<string, NodeJS.Timeout>();
  private readonly logger = new Logger(GameService.name);

  constructor(
    private gameDao: GameDao,
    private gameGateway: GameGateway,
  ) {}

  launchGame(players: string[], gamemode: Gamemode, config: GamemodeConfig): string {
    const game = new Game(gamemode, new GameMap(config.mapWidth, config.mapHeight), players);
    this.spawnPlayers(game, players);
    game.state = 'running';
    game.tick = 0;
    game.startedAt = Date.now();
    game.tickRateMs = config.tickRateMs;
    this.gameDao.saveGame(game);
    this.gameGateway.broadcastGameStart(game);
    this.startTick(game, config.tickRateMs);
    this.logger.log(`launched game=${game.id} players=${players.length} gamemode=${gamemode}`);
    return game.id;
  }

  private spawnPlayers(game: Game, players: string[]) {
    const positions = this.generateSpawnPositions(game.map, players.length);
    for (let i = 0; i < players.length; i++) {
      const pos = positions[i];
      const soldier = createSoldier(players[i], pos.x, pos.y);
      game.map.addEntity(soldier);
      this.logger.log(`spawned player=${players[i]} at (${pos.x},${pos.y})`);
    }
  }

  private generateSpawnPositions(map: GameMap, count: number): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    const margin = 2;
    const regionW = Math.floor((map.width - margin * 2) / Math.max(count, 1));
    const midH = Math.floor(map.height / 2);

    for (let i = 0; i < count; i++) {
      const cx = margin + regionW * i + Math.floor(regionW / 2);
      for (let dy = -2; dy <= 2; dy++) {
        const x = cx;
        const y = midH + dy;
        if (map.isInBounds(x, y) && map.isTileEmpty(x, y)) {
          positions.push({ x, y });
          break;
        }
      }
    }

    return positions;
  }

  queueAction(
    gameId: string,
    playerId: string,
    body: { type: string; payload: unknown },
  ): { accepted: boolean; actionId?: string } {
    const game = this.gameDao.getGame(gameId);
    if (!game || game.state !== 'running') {
      this.logger.warn(`queue rejected: game=${gameId} state=${game?.state} player=${playerId} type=${body.type}`);
      return { accepted: false };
    }

    const action: QueuedAction = {
      id: randomUUID(),
      playerId,
      type: body.type,
      payload: body.payload,
      timestamp: Date.now(),
    };
    game.actionQueue.push(action);
    this.logger.log(`queued: id=${action.id} game=${gameId} player=${playerId} type=${body.type}`);
    return { accepted: true, actionId: action.id };
  }

  getGame(gameId: string): Game | undefined {
    return this.gameDao.getGame(gameId);
  }

  private startTick(game: Game, rateMs: number) {
    const interval = setInterval(() => this.tick(game.id), rateMs);
    this.ticks.set(game.id, interval);
    this.logger.log(`tick started game=${game.id} rate=${rateMs}ms`);
  }

  private stopTick(gameId: string) {
    const interval = this.ticks.get(gameId);
    if (!interval) return;
    clearInterval(interval);
    this.ticks.delete(gameId);
    this.logger.log(`tick stopped game=${gameId}`);
  }

  private tick(gameId: string) {
    const game = this.gameDao.getGame(gameId);
    if (!game || game.state !== 'running') return;

    game.tick++;
    const actions = game.actionQueue.splice(0, game.actionQueue.length);
    if (actions.length > 0) {
      this.logger.log(`tick=${game.tick} processing ${actions.length} actions`);
    }
    for (const action of actions) this.processAction(game, action);

    this.processMovement(game);
    this.processAutoAttack(game);
    this.processTimers(game);

    const config = GAMEMODE_CONFIGS[game.gamemode];
    let winners: string[] = [];

    if (game.tick > 10) {
      winners = config.winCondition(game);
    }

    if (winners.length === 0 && config.maxDurationMs && game.tick > 10) {
      const elapsed = Date.now() - game.startedAt;
      if (elapsed >= config.maxDurationMs) {
        this.logger.log(`time limit reached game=${game.id} elapsed=${elapsed}ms`);
        const counts = new Map<string, number>();
        for (const entity of game.map.entities.values()) {
          if (entity.type === 'soldier') {
            counts.set(entity.ownerId, (counts.get(entity.ownerId) || 0) + 1);
          }
        }
        if (counts.size > 0) {
          let maxCount = 0;
          for (const [pid, count] of counts) {
            if (count > maxCount) { maxCount = count; winners = [pid]; }
            else if (count === maxCount) { winners.push(pid); }
          }
        } else {
          winners = game.players;
        }
        this.logger.log(`time limit winner: soldiers=${JSON.stringify([...counts])} winners=[${winners}]`);
      }
    }

    if (winners.length > 0) {
      this.logger.log(`game finished game=${game.id} winners=${winners.join(',')}`);
      game.winners = winners;
      game.state = 'finished';
      this.stopTick(game.id);
      this.gameDao.saveGame(game);
    }

    this.gameGateway.broadcastStateUpdate(game);
  }

  private processAction(game: Game, action: QueuedAction) {
    this.logger.log(`processing: id=${action.id} type=${action.type} player=${action.playerId}`);
    switch (action.type) {
      case 'walk': return this.processWalk(game, action);
      case 'attack': return this.processAttackCommand(game, action);
      case 'build_barracks': return this.processBuildBarracks(game, action);
      default: this.logger.warn(`unknown action type: ${action.type}`);
    }
  }

  private processWalk(game: Game, action: QueuedAction) {
    const payload = action.payload as WalkPayload;
    const entities = this.resolveEntities(game, payload.entityIds, action.playerId);
    if (entities.length === 0) {
      this.logger.warn(`walk: no resolvable entities`);
      return;
    }

    const config = GAMEMODE_CONFIGS[game.gamemode];
    const isAvailable = (x: number, y: number) => game.map.isTileEmpty(x, y);
    const targets = getSpreadPositions(payload.x, payload.y, entities.length, isAvailable, game.map.width, game.map.height);
    this.logger.log(`walk: entities=${entities.length} targets=${targets.length} target=(${payload.x},${payload.y})`);

    let anySucceeded = false;
    for (let i = 0; i < entities.length && i < targets.length; i++) {
      const e = entities[i];
      if (e.state.status === 'building-barracks') { continue; }
      const t = targets[i];
      const path = findPath(e.x, e.y, t.x, t.y, (x, y) => !game.map.isTileEmpty(x, y), game.map.width, game.map.height);
      if (!path) {
        this.logger.warn(`walk: no path entity=${e.id} from (${e.x},${e.y}) to (${t.x},${t.y})`);
        continue;
      }

      e.state = { status: 'moving', path };
      e.lastCommand = 'move';
      anySucceeded = true;
      this.logger.log(`walk: entity=${e.id} path=${path.length} steps`);
    }

    if (!anySucceeded) {
      this.logger.warn(`walk: all failed, re-queuing action`);
      game.actionQueue.push(action);
    }
  }

  private processAttackCommand(game: Game, action: QueuedAction) {
    const payload = action.payload as AttackPayload;
    const config = GAMEMODE_CONFIGS[game.gamemode];
    const entities = this.resolveEntities(game, payload.entityIds, action.playerId);
    if (entities.length === 0) {
      this.logger.warn(`attack: no resolvable entities`);
      return;
    }

    this.logger.log(`attack: entities=${entities.length} target=(${payload.x},${payload.y})`);

    let anySucceeded = false;
    for (const entity of entities) {
      if (entity.state.status === 'building-barracks') { continue; }
      const enemies = this.findEnemiesNear(game, entity, payload.x, payload.y, config.soldierDetectRange);

      if (enemies.length > 0) {
        const target = enemies[0];
        const dist = manhattan(entity, target);
        this.logger.log(`attack: entity=${entity.id} vs target=${target.id} dist=${dist}`);

        if (dist <= config.soldierAttackRange) {
          if (target.type === 'soldier') {
            const attackerWins = Math.random() < 0.5;
            if (attackerWins) {
              game.map.removeEntity(target.id);
              entity.state = { status: 'idle' };
              entity.lastCommand = 'attack';
              this.logger.log(`attack: entity=${entity.id} killed target=${target.id}`);
            } else {
              game.map.removeEntity(entity.id);
              this.logger.log(`attack: entity=${entity.id} killed by target=${target.id}`);
            }
          } else {
            if (Math.random() < config.soldierAttackBarracksKillChance) {
              game.map.removeEntity(target.id);
              entity.state = { status: 'idle' };
              entity.lastCommand = 'attack';
              this.logger.log(`attack: entity=${entity.id} destroyed barracks=${target.id}`);
            } else {
              entity.state = { status: 'idle' };
              this.logger.log(`attack: entity=${entity.id} failed to destroy barracks=${target.id}`);
            }
          }
          anySucceeded = true;
          continue;
        }

        const path = findPath(entity.x, entity.y, target.x, target.y, (x, y) => !game.map.isTileEmpty(x, y), game.map.width, game.map.height);
        if (path) {
          entity.state = { status: 'moving-to-attack', targetId: target.id, path };
          entity.lastCommand = 'attack';
          anySucceeded = true;
          this.logger.log(`attack: entity=${entity.id} pursuing target=${target.id}`);
          continue;
        }
        this.logger.warn(`attack: no path to target=${target.id}`);
      }

      const path = findPath(entity.x, entity.y, payload.x, payload.y, (x, y) => !game.map.isTileEmpty(x, y), game.map.width, game.map.height);
      if (path) {
        entity.state = { status: 'moving', path };
        entity.lastCommand = 'attack';
        anySucceeded = true;
        this.logger.log(`attack: entity=${entity.id} moving to guard (${payload.x},${payload.y})`);
      } else {
        this.logger.warn(`attack: no path to guard tile (${payload.x},${payload.y})`);
      }
    }

    if (!anySucceeded) {
      this.logger.warn(`attack: all failed, re-queuing action`);
      game.actionQueue.push(action);
    }
  }

  private findEnemiesNear(game: Game, entity: Entity, nearX: number, nearY: number, range: number): Entity[] {
    const results: { entity: Entity; dist: number }[] = [];
    for (const other of game.map.entities.values()) {
      if (other.ownerId === entity.ownerId) continue;
      if (other.type !== 'soldier' && other.type !== 'barracks') continue;
      const dist = manhattan(other, { x: nearX, y: nearY });
      if (dist > range) continue;
      results.push({ entity: other, dist });
    }
    results.sort((a, b) => a.dist - b.dist);
    return results.map(r => r.entity);
  }

  private resolveEntities(game: Game, entityIds: string[], playerId: string): Entity[] {
    const result: Entity[] = [];
    for (const id of entityIds) {
      const e = game.map.entities.get(id);
      if (!e) { this.logger.warn(`resolve: entity=${id} not found`); continue; }
      if (e.ownerId !== playerId) { this.logger.warn(`resolve: entity=${id} owner mismatch`); continue; }
      if (e.type !== 'soldier') { this.logger.warn(`resolve: entity=${id} type=${e.type}`); continue; }
      result.push(e);
    }
    result.sort((a, b) => a.id.localeCompare(b.id));
    this.logger.log(`resolve: player=${playerId} requested=${entityIds.length} resolved=${result.length}`);
    return result;
  }

  private processBuildBarracks(game: Game, action: QueuedAction) {
    const payload = action.payload as BuildPayload;
    for (const entityId of payload.entityIds) {
      const entity = game.map.entities.get(entityId);
      if (!entity) { this.logger.warn(`build: entity=${entityId} not found`); continue; }
      if (entity.ownerId !== action.playerId) { this.logger.warn(`build: entity=${entityId} owner mismatch`); continue; }
      if (entity.state.status !== 'idle') { this.logger.warn(`build: entity=${entityId} not idle`); continue; }
      if (entity.type !== 'soldier') { this.logger.warn(`build: entity=${entityId} not soldier`); continue; }

      const adj = game.map.findNearestEmptyTileAvoidBarracks(entity.x, entity.y);
      if (!adj) { this.logger.warn(`build: entity=${entityId} no valid tile (need 1-tile gap from barracks)`); continue; }

      entity.state = { status: 'building-barracks', startedAtTick: game.tick };
      const barracks = createBarracks(action.playerId, adj.x, adj.y, game.tick);
      game.map.addEntity(barracks);
      this.logger.log(`build: entity=${entityId} barracks=${barracks.id} at (${adj.x},${adj.y})`);
    }
  }

  private processMovement(game: Game) {
    for (const entity of game.map.entities.values()) {
      if (entity.state.status === 'moving') this.advanceMoving(entity, game);
      if (entity.state.status === 'moving-to-attack') this.advanceAttackMove(entity, game);
    }
  }

  private advanceMoving(entity: Entity, game: Game) {
    const state = entity.state as { status: 'moving'; path: { x: number; y: number }[] };
    if (state.path.length === 0) { entity.state = { status: 'idle' }; return; }

    const blocked = !game.map.isTileEmpty(state.path[0].x, state.path[0].y);
    if (blocked) {
      const dst = state.path[state.path.length - 1];
      const alt = findPath(entity.x, entity.y, dst.x, dst.y, (x, y) => !game.map.isTileEmpty(x, y), game.map.width, game.map.height);
      if (!alt || alt.length === 0) { return; }
      state.path = alt;
    }

    game.map.moveEntity(entity.id, state.path[0].x, state.path[0].y);
    state.path.shift();

    if (state.path.length === 0) { entity.state = { status: 'idle' }; }
  }

  private advanceAttackMove(entity: Entity, game: Game) {
    const config = GAMEMODE_CONFIGS[game.gamemode];
    const state = entity.state as { status: 'moving-to-attack'; targetId: string; path: { x: number; y: number }[] };
    const target = game.map.entities.get(state.targetId);
    if (!target) { entity.state = { status: 'idle' }; return; }

    if (manhattan(entity, target) <= config.soldierAttackRange) {
      if (target.type === 'soldier') {
        const attackerWins = Math.random() < 0.5;
        if (attackerWins) {
          game.map.removeEntity(target.id);
          entity.state = { status: 'idle' };
          this.logger.log(`advanceAttack: entity=${entity.id} killed target=${target.id}`);
        } else {
          game.map.removeEntity(entity.id);
          this.logger.log(`advanceAttack: entity=${entity.id} killed by target=${target.id}`);
        }
      } else {
        if (Math.random() < config.soldierAttackBarracksKillChance) {
          game.map.removeEntity(target.id);
          entity.state = { status: 'idle' };
          this.logger.log(`advanceAttack: entity=${entity.id} destroyed barracks=${target.id}`);
        } else {
          entity.state = { status: 'idle' };
          this.logger.log(`advanceAttack: entity=${entity.id} failed to destroy barracks=${target.id}`);
        }
      }
      return;
    }

    const recalcPath = () => findPath(entity.x, entity.y, target.x, target.y, (x, y) => !game.map.isTileEmpty(x, y), game.map.width, game.map.height);

    if (state.path.length === 0) {
      const path = recalcPath();
      if (!path) { return; }
      state.path = path;
    }

    const blocked = !game.map.isTileEmpty(state.path[0].x, state.path[0].y);
    if (blocked) {
      const path = recalcPath();
      if (!path || path.length === 0) { return; }
      state.path = path;
    }

    game.map.moveEntity(entity.id, state.path[0].x, state.path[0].y);
    state.path.shift();
  }

  private processAutoAttack(game: Game) {
    const config = GAMEMODE_CONFIGS[game.gamemode];
    for (const entity of game.map.entities.values()) {
      if (entity.type !== 'soldier') continue;
      if (entity.state.status !== 'idle') continue;
      if (entity.lastCommand === 'move') continue;

      let nearest: Entity | null = null;
      let nearestDist = Infinity;
      let preferSoldier = false;

      for (const other of game.map.entities.values()) {
        if (other.ownerId === entity.ownerId) continue;
        if (other.type !== 'soldier' && other.type !== 'barracks') continue;
        const dist = manhattan(entity, other);
        if (dist > config.soldierDetectRange) continue;

        if (other.type === 'soldier') {
          if (!preferSoldier || dist < nearestDist) {
            nearest = other;
            nearestDist = dist;
            preferSoldier = true;
          }
        } else if (!preferSoldier && dist < nearestDist) {
          nearest = other;
          nearestDist = dist;
        }
      }

      if (!nearest) continue;

      if (nearestDist <= config.soldierAttackRange) {
        if (nearest.type === 'soldier') {
          const attackerWins = Math.random() < 0.5;
          if (attackerWins) {
            game.map.removeEntity(nearest.id);
            this.logger.log(`autoAttack: entity=${entity.id} killed ${nearest.id}`);
          } else {
            game.map.removeEntity(entity.id);
            this.logger.log(`autoAttack: entity=${entity.id} killed by ${nearest.id}`);
          }
        } else {
          if (Math.random() < config.soldierAttackBarracksKillChance) {
            game.map.removeEntity(nearest.id);
            this.logger.log(`autoAttack: entity=${entity.id} destroyed barracks=${nearest.id}`);
          }
        }
      } else {
        const path = findPath(entity.x, entity.y, nearest.x, nearest.y, (x, y) => !game.map.isTileEmpty(x, y), game.map.width, game.map.height);
        if (!path) continue;
        entity.state = { status: 'moving-to-attack', targetId: nearest.id, path };
        this.logger.log(`autoAttack: entity=${entity.id} chasing ${nearest.type}=${nearest.id}`);
      }
    }
  }

  private processTimers(game: Game) {
    const config = GAMEMODE_CONFIGS[game.gamemode];
    for (const entity of game.map.entities.values()) {
      if (entity.type === 'soldier' && entity.state.status === 'building-barracks') {
        const s = entity.state as { status: 'building-barracks'; startedAtTick: number };
        if (game.tick - s.startedAtTick >= config.barracksBuildTime) {
          entity.state = { status: 'idle' };
        }
      }
      if (entity.type === 'barracks' && entity.state.status === 'ready') {
        const s = entity.state as { status: 'ready'; lastProducedAtTick: number };
        if (game.tick - s.lastProducedAtTick >= config.soldierProductionTime) {
          const adj = game.map.findNearestEmptyTile(entity.x, entity.y);
          if (adj) {
            const soldier = createSoldier(entity.ownerId, adj.x, adj.y);
            game.map.addEntity(soldier);
            entity.state = { status: 'ready', lastProducedAtTick: game.tick };
          }
        }
      }
      if (entity.type === 'barracks' && entity.state.status === 'building') {
        const s = entity.state as { status: 'building'; startedAtTick: number };
        if (game.tick - s.startedAtTick >= config.barracksBuildTime) {
          entity.state = { status: 'ready', lastProducedAtTick: game.tick };
        }
      }
    }
  }
}
