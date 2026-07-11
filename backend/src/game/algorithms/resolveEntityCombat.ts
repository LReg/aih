import { Logger } from '@nestjs/common';
import { Entity } from '../game-map';

const logger = new Logger('ResolveEntityCombat');

export function resolveEntityCombat(
  entity: Entity,
  target: Entity,
  barracksKillChance: number,
): { killed: string } | null {
  if (target.type === 'soldier') {
    const attackerWins = Math.random() < 0.5;
    const killedId = attackerWins ? target.id : entity.id;
    logger.log(`combat: entity=${entity.id} ${attackerWins ? `killed target=${target.id}` : `killed by target=${target.id}`}`);
    return { killed: killedId };
  }

  if (Math.random() < barracksKillChance) {
    logger.log(`combat: entity=${entity.id} destroyed barracks=${target.id}`);
    return { killed: target.id };
  }
  logger.log(`combat: entity=${entity.id} failed to destroy barracks=${target.id}`);
  return null;
}
