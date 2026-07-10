import { Logger } from '@nestjs/common';
import { Game } from '../game';
import { Entity } from '../game-map';

const logger = new Logger('ResolveEntityCombat');

export function resolveEntityCombat(game: Game, entity: Entity, target: Entity, barracksKillChance: number): boolean {
  if (target.type === 'soldier') {
    const attackerWins = Math.random() < 0.5;
    if (attackerWins) {
      game.map.removeEntity(target.id);
      logger.log(`combat: entity=${entity.id} killed target=${target.id}`);
    } else {
      game.map.removeEntity(entity.id);
      logger.log(`combat: entity=${entity.id} killed by target=${target.id}`);
    }
    return attackerWins;
  }

  if (Math.random() < barracksKillChance) {
    game.map.removeEntity(target.id);
    logger.log(`combat: entity=${entity.id} destroyed barracks=${target.id}`);
    return true;
  }
  logger.log(`combat: entity=${entity.id} failed to destroy barracks=${target.id}`);
  return true;
}
