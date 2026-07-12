import { Game } from '../../game';
import { Entity } from '../../game-map';
import { GamemodeConfig } from '../../gamemode.config';
import { isPeaceTime } from '../../algorithms/isPeaceTime';
import { findNearestEnemy } from '../../algorithms/findNearestEnemy';
import { resolveEntityCombat } from '../../algorithms/resolveEntityCombat';
import { manhattan } from '../../algorithms/findPath';
import { advancePath } from '../../algorithms/movement/advancePath';
import { PathCache } from '../../algorithms/movement/pathCache';

export function processAttack(game: Game, entity: Entity, config: GamemodeConfig, toRemove: string[], pathCache: PathCache): void {
  if (isPeaceTime(game)) return;

  entity.lastCommand = 'attack';

  const p = entity.path;
  const pi = entity.pathIndex;
  if (p && pi !== undefined) {
    const rem = p.length - pi;
    if (rem > config.soldierAttackRange + 2 && pi < p.length) {
      const next = p[pi];
      if (game.map.isTileEmpty(next.x, next.y)) {
        game.map.moveEntity(entity.id, next.x, next.y);
        entity.pathIndex = pi + 1;
        return;
      }
      entity.path = undefined;
    }
  }

  const a = entity.state as { status: 'attacking'; targetX: number; targetY: number };
  const nearest = findNearestEnemy(game, entity, config.soldierDetectRange);

  if (nearest) {
    if (manhattan(entity, nearest) <= config.soldierAttackRange) {
      entity.path = undefined;
      const result = resolveEntityCombat(entity, nearest, config.soldierAttackBarracksKillChance);
      if (result) toRemove.push(result.killed);
    } else {
      advancePath(game, entity, nearest.x, nearest.y, pathCache);
    }
  } else if (entity.x !== a.targetX || entity.y !== a.targetY) {
    advancePath(game, entity, a.targetX, a.targetY, pathCache);
  }
}
