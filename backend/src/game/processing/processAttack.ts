import { Game } from '../game';
import { findPath, manhattan } from '../game-map';
import { GAMEMODE_CONFIGS } from '../gamemode.config';
import { isPeaceTime } from '../algorithms/isPeaceTime';
import { findNearestEnemy } from '../algorithms/findNearestEnemy';
import { resolveEntityCombat } from '../actions/attack.action';

export function processAttack(game: Game): void {
  if (isPeaceTime(game)) return;
  const config = GAMEMODE_CONFIGS[game.gamemode];

  for (const entity of game.map.entities.values()) {
    if (entity.type !== 'soldier') continue;
    if (entity.state.status === 'building-barracks') continue;

    const isAttacking = entity.state.status === 'attacking';
    const isIdleGuard = entity.state.status === 'idle' && entity.lastCommand === 'attack';
    if (!isAttacking && !isIdleGuard) continue;

    const attackState = isAttacking
      ? (entity.state as { status: 'attacking'; targetX: number; targetY: number })
      : null;
    const guardX = attackState ? attackState.targetX : entity.x;
    const guardY = attackState ? attackState.targetY : entity.y;

    const nearest = findNearestEnemy(game, entity, config.soldierDetectRange);

    if (nearest) {
      if (manhattan(entity, nearest) <= config.soldierAttackRange) {
        resolveEntityCombat(game, entity, nearest, config.soldierAttackBarracksKillChance);
      } else {
        const path = findPath(entity.x, entity.y, nearest.x, nearest.y,
          (x, y) => !game.map.isTileEmpty(x, y),
          game.map.width, game.map.height);
        if (path && path.length >= 2 && game.map.isTileEmpty(path[1].x, path[1].y)) {
          game.map.moveEntity(entity.id, path[1].x, path[1].y);
        }
      }
    } else {
      if (entity.x === guardX && entity.y === guardY) {
        if (isAttacking) entity.lastCommand = 'attack';
        continue;
      }
      const path = findPath(entity.x, entity.y, guardX, guardY,
        (x, y) => !game.map.isTileEmpty(x, y),
        game.map.width, game.map.height);
      if (path && path.length >= 2 && game.map.isTileEmpty(path[1].x, path[1].y)) {
        game.map.moveEntity(entity.id, path[1].x, path[1].y);
      }
    }
  }
}

