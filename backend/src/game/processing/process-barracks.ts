import { Game } from '../game';
import { GamemodeConfig } from '../gamemode.config';
import { createSoldier, SoldierClass } from '../game-map';

export function processBarracks(game: Game, config: GamemodeConfig): void {
  for (const entity of game.map.barracks.values()) {
    if (entity.state.status === 'ready') {
      const s = entity.state as { status: 'ready'; lastProducedAtTick: number; spawnClass?: SoldierClass };
      if (game.tick - s.lastProducedAtTick >= config.soldierProductionTime) {
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
