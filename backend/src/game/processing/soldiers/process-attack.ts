import { Game, Effect } from '../../game';
import { Entity } from '../../game-map';
import { GamemodeConfig } from '../../gamemode.config';
import { isPeaceTime } from '../../algorithms/isPeaceTime';
import { findNearestEnemy } from '../../algorithms/findNearestEnemy';
import { resolveEntityCombat } from '../../algorithms/resolveEntityCombat';
import { manhattan } from '../../algorithms/findPath';
import { advancePath } from '../../algorithms/movement/advancePath';
import { PathCache } from '../../algorithms/movement/pathCache';

function tryAdvanceAlongPath(game: Game, entity: Entity): boolean {
  if (!entity.path || entity.pathIndex === undefined || entity.pathIndex >= entity.path.length) return false;

  const next = entity.path[entity.pathIndex];
  if (!game.map.isTileEmpty(next.x, next.y)) {
    entity.path = undefined;
    return false;
  }

  game.map.moveEntity(entity.id, next.x, next.y);
  entity.pathIndex++;
  return true;
}

function attackRange(entity: Entity, config: GamemodeConfig): number {
  return entity.class === 'archer' ? config.archerAttackRange : config.soldierAttackRange;
}

function detectRange(entity: Entity, config: GamemodeConfig): number {
  return entity.class === 'archer' ? config.archerDetectRange : config.soldierDetectRange;
}

export function processAttack(game: Game, entity: Entity, config: GamemodeConfig, toRemove: string[], pathCache: PathCache): void {
  if (isPeaceTime(game)) return;

  entity.lastCommand = 'attack';
  const a = entity.state as { status: 'attacking'; targetX: number; targetY: number };

  // Phase 1: locked target
  if (entity.lockedTargetId) {
    const target = game.map.entities.get(entity.lockedTargetId);
    if (target && manhattan(entity, target) <= detectRange(entity, config)) {
      if (manhattan(entity, target) <= attackRange(entity, config)) {
        entity.path = undefined;
        const result = resolveEntityCombat(entity, target, config.soldierAttackBarracksKillChance, game.effects);
        if (result) toRemove.push(result.killed);
        return;
      }
      if (tryAdvanceAlongPath(game, entity)) return;
      advancePath(game, entity, target.x, target.y, pathCache);
      return;
    }
    entity.lockedTargetId = undefined;
    entity.path = undefined;
  }

  // Phase 2: find new enemy
  const nearest = findNearestEnemy(game, entity, detectRange(entity, config));
  if (nearest) {
    entity.lockedTargetId = nearest.id;
    if (manhattan(entity, nearest) <= attackRange(entity, config)) {
      const result = resolveEntityCombat(entity, nearest, config.soldierAttackBarracksKillChance, game.effects);
      if (result) toRemove.push(result.killed);
      return;
    }
    if (entity.path && entity.pathIndex !== undefined && entity.pathIndex < entity.path.length) {
      if (tryAdvanceAlongPath(game, entity)) return;
    }
    advancePath(game, entity, nearest.x, nearest.y, pathCache);
    return;
  }

  // Phase 3: no enemy found — walk to original destination
  if (entity.x !== a.targetX || entity.y !== a.targetY) {
    if (tryAdvanceAlongPath(game, entity)) return;
    advancePath(game, entity, a.targetX, a.targetY, pathCache);
  }
}
