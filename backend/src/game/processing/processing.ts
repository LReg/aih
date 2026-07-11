import { Game } from '../game';
import { createSoldier } from '../game-map';
import { GAMEMODE_CONFIGS } from '../gamemode.config';
import { isPeaceTime } from '../algorithms/isPeaceTime';
import { findNearestEnemy } from '../algorithms/findNearestEnemy';
import { resolveEntityCombat } from '../algorithms/resolveEntityCombat';
import { manhattan } from '../algorithms/findPath';
import { advancePath } from '../algorithms/movement/advancePath';
import { clearPath } from '../algorithms/movement/tryCachedStep';
import { PathCache } from '../algorithms/movement/pathCache';

export function processGame(game: Game): void {
  if (isPeaceTime(game)) return;
  const config = GAMEMODE_CONFIGS[game.gamemode];
  const pathCache = new PathCache();
  const toRemove: string[] = [];

  for (const entity of game.map.soldiers.values()) {
    if (entity.state.status === 'building-barracks') {
      const s = entity.state as { status: 'building-barracks'; startedAtTick: number };
      if (game.tick - s.startedAtTick >= config.barracksBuildTime) {
        entity.state = { status: 'idle' };
        game.map.markChanged(entity.id);
      }
      continue;
    }

    if (entity.state.status === 'attacking') {
      entity.lastCommand = 'attack';
      const a = entity.state as { status: 'attacking'; targetX: number; targetY: number };
      const nearest = findNearestEnemy(game, entity, config.soldierDetectRange);

      if (nearest) {
        if (manhattan(entity, nearest) <= config.soldierAttackRange) {
          const result = resolveEntityCombat(entity, nearest, config.soldierAttackBarracksKillChance);
          if (result) toRemove.push(result.killed);
        } else {
          advancePath(game, entity, nearest.x, nearest.y, pathCache);
        }
      } else if (entity.x !== a.targetX || entity.y !== a.targetY) {
        advancePath(game, entity, a.targetX, a.targetY, pathCache);
      }
      continue;
    }

    if (entity.state.status === 'moving') {
      const s = entity.state as { status: 'moving'; targetX: number; targetY: number };
      if (entity.x === s.targetX && entity.y === s.targetY) {
        clearPath(entity);
      } else {
        advancePath(game, entity, s.targetX, s.targetY, pathCache);
      }
      continue;
    }
  }

  for (const entity of game.map.barracks.values()) {
    if (entity.state.status === 'ready') {
      const s = entity.state as { status: 'ready'; lastProducedAtTick: number };
      if (game.tick - s.lastProducedAtTick >= config.soldierProductionTime) {
        const adj = game.map.findNearestEmptyTile(entity.x, entity.y);
        if (adj) {
          const soldier = createSoldier(entity.ownerId, adj.x, adj.y);
          game.map.addEntity(soldier);
          entity.state = { status: 'ready', lastProducedAtTick: game.tick };
          game.map.markChanged(entity.id);
        }
      }
    }
    if (entity.state.status === 'building') {
      const s = entity.state as { status: 'building'; startedAtTick: number };
      if (game.tick - s.startedAtTick >= config.barracksBuildTime) {
        entity.state = { status: 'ready', lastProducedAtTick: game.tick };
        game.map.markChanged(entity.id);
      }
    }
  }

  for (const id of toRemove) {
    game.map.removeEntity(id);
  }
}
