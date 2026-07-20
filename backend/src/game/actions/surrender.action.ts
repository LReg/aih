import { Logger } from '@nestjs/common';
import { Game, QueuedAction } from '../game';
import { Gamemode } from '../gamemode.config';

const logger = new Logger('SurrenderAction');

export function surrenderAction(game: Game, action: QueuedAction): void {
  const entities = game.map.getEntitiesByOwner(action.playerId);

  for (const entity of entities) {
    game.map.removeEntity(entity.id);
  }

  if (game.gamemode === Gamemode.World) {
    const idx = game.players.indexOf(action.playerId);
    if (idx >= 0) game.players.splice(idx, 1);
    game.losers.push(action.playerId);
    logger.log(`player=${action.playerId} surrendered, removed ${entities.length} entities`);
    return;
  }

  game.losers.push(action.playerId);
  if (!game.eliminationOrder.includes(action.playerId)) {
    game.eliminationOrder.push(action.playerId);
  }

  logger.log(`player=${action.playerId} surrendered, removed ${entities.length} entities`);
}
