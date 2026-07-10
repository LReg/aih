import { Logger } from '@nestjs/common';
import { Game, QueuedAction } from '../game';

const logger = new Logger('SurrenderAction');

export function surrenderAction(game: Game, action: QueuedAction): void {
  const entities = game.map.getEntitiesByOwner(action.playerId);

  for (const entity of entities) {
    game.map.removeEntity(entity.id);
  }

  game.losers.push(action.playerId);

  logger.log(`player=${action.playerId} surrendered, removed ${entities.length} entities`);
}
