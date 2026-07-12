import { Game } from '../game';
import { processSoldiers } from './process-soldiers';
import { processBarracks } from './process-barracks';

export function processGame(game: Game): void {
  const config = game.config;
  const toRemove: string[] = [];

  processSoldiers(game, config, toRemove);
  processBarracks(game, config);

  for (const id of toRemove) {
    game.map.removeEntity(id);
  }
}
