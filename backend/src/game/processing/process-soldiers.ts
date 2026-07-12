import { Game } from '../game';
import { GamemodeConfig } from '../gamemode.config';
import { PathCache } from '../algorithms/movement/pathCache';
import { processAttack } from './soldiers/process-attack';
import { processMove } from './soldiers/process-move';

export function processSoldiers(game: Game, config: GamemodeConfig, toRemove: string[]): void {
  const pathCache = new PathCache();

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
      processAttack(game, entity, config, toRemove, pathCache);
      continue;
    }

    if (entity.state.status === 'moving') {
      processMove(game, entity, pathCache);
      continue;
    }
  }
}
