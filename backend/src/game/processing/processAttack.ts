import { Game } from '../game';
import { manhattan } from '../algorithms/findPath';
import { advancePath } from '../algorithms/movement/advancePath';
import { PathCache } from '../algorithms/movement/pathCache';
import { GAMEMODE_CONFIGS } from '../gamemode.config';
import { isPeaceTime } from '../algorithms/isPeaceTime';
import { findNearestEnemy } from '../algorithms/findNearestEnemy';
import { resolveEntityCombat } from '../algorithms/resolveEntityCombat';

export function processAttack(game: Game, pathCache: PathCache): void {
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
        advancePath(game, entity, nearest.x, nearest.y, pathCache);
      }
    } else if (entity.x !== a.targetX || entity.y !== a.targetY) {
      advancePath(game, entity, a.targetX, a.targetY, pathCache);
    }
  }
}
