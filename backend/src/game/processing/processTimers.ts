import { Game } from '../game';
import { createSoldier } from '../game-map';
import { GAMEMODE_CONFIGS } from '../gamemode.config';

export function processTimers(game: Game): void {
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