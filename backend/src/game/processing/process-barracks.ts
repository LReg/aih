import { Game, productionMultiplier } from '../game';
import { GamemodeConfig } from '../gamemode.config';
import { createSoldier, SoldierClass } from '../game-map';

function countPlayerSoldiers(game: Game, ownerId: string): number {
  let count = 0;
  for (const e of game.map.soldiers.values()) {
    if (e.ownerId === ownerId) count++;
  }
  return count;
}

export function processBarracks(game: Game, config: GamemodeConfig): void {
  const cache = new Map<string, number>();

  for (const entity of game.map.barracks.values()) {
    if (entity.state.status === 'ready') {
      const s = entity.state as { status: 'ready'; lastProducedAtTick: number; spawnClass?: SoldierClass };
      let count = cache.get(entity.ownerId);
      if (count === undefined) {
        count = countPlayerSoldiers(game, entity.ownerId);
        cache.set(entity.ownerId, count);
      }
      const mult = productionMultiplier(count, config.midSoldierCount);
      const effectiveTime = Math.max(1, Math.round(config.soldierProductionTime / mult));
      if (game.tick - s.lastProducedAtTick >= effectiveTime) {
        const adj = game.map.findNearestEmptyTile(entity.x, entity.y);
        if (adj) {
          const soldier = createSoldier(entity.ownerId, adj.x, adj.y, s.spawnClass);
          game.map.addEntity(soldier);
          entity.state = { status: 'ready', lastProducedAtTick: game.tick, spawnClass: s.spawnClass };
          game.map.markChanged(entity.id);
        }
      }
    }
    if (entity.state.status === 'building') {
      const s = entity.state as { status: 'building'; startedAtTick: number; spawnClass?: SoldierClass };
      if (game.tick - s.startedAtTick >= config.barracksBuildTime) {
        entity.state = { status: 'ready', lastProducedAtTick: game.tick, spawnClass: s.spawnClass };
        game.map.markChanged(entity.id);
      }
    }
  }
}
