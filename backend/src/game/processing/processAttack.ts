import { Game } from '../game';
import { Entity } from '../game-map';
import { findPath, manhattan } from '../algorithms/findPath';
import { GAMEMODE_CONFIGS } from '../gamemode.config';
import { isPeaceTime } from '../algorithms/isPeaceTime';
import { findNearestEnemy } from '../algorithms/findNearestEnemy';
import { resolveEntityCombat } from '../actions/attack.action';

function moveToward(game: Game, entity: Entity, targetX: number, targetY: number) {
  if (entity.path && entity.pathIndex !== undefined) {
    const idx = entity.pathIndex;
    const dest = entity.path[entity.path.length - 1];
    if (idx < entity.path.length && dest.x === targetX && dest.y === targetY) {
      const prev = entity.path[idx - 1];
      if (entity.x === prev.x && entity.y === prev.y) {
        const next = entity.path[idx];
        if (game.map.isTileEmpty(next.x, next.y)) {
          game.map.moveEntity(entity.id, next.x, next.y);
          entity.pathIndex = idx + 1;
          return;
        }
      }
    }
    entity.path = undefined;
  }

  const path = findPath(
    entity.x, entity.y, targetX, targetY,
    (x, y) => !game.map.isTileEmpty(x, y),
    game.map.width, game.map.height,
  );

  if (!path || path.length < 2) return;

  entity.path = path;
  entity.pathIndex = 1;
  const next = path[1];
  if (game.map.isTileEmpty(next.x, next.y)) {
    game.map.moveEntity(entity.id, next.x, next.y);
    entity.pathIndex = 2;
  } else {
    entity.path = undefined;
  }
}

export function processAttack(game: Game): void {
  if (isPeaceTime(game)) return;
  const config = GAMEMODE_CONFIGS[game.gamemode];

  for (const entity of game.map.entities.values()) {
    if (entity.type !== 'soldier') continue;
    if (!(entity.state.status === 'attacking')) continue;
    entity.lastCommand = 'attack';

    const a = entity.state as { status: 'attacking'; targetX: number; targetY: number };
    const nearest = findNearestEnemy(game, entity, config.soldierDetectRange);

    if (nearest) {
      if (manhattan(entity, nearest) <= config.soldierAttackRange) {
        resolveEntityCombat(game, entity, nearest, config.soldierAttackBarracksKillChance);
      } else {
        moveToward(game, entity, nearest.x, nearest.y);
      }
    } else if (entity.x !== a.targetX || entity.y !== a.targetY) {
      moveToward(game, entity, a.targetX, a.targetY);
    }
  }
}
