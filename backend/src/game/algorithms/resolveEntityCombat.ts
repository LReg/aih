import { Logger } from '@nestjs/common';
import { Entity, CLASS_STATS } from '../game-map';
import type { Effect } from '../game';

const logger = new Logger('ResolveEntityCombat');

export function resolveEntityCombat(
  entity: Entity,
  target: Entity,
  effects: Effect[],
): { killed: string } | null {
  const eClass = (entity.class as string) || 'soldier';
  const tClass = (target.class as string) || 'soldier';
  const eDmg = CLASS_STATS[eClass]?.damage ?? 25;
  const tDmg = CLASS_STATS[tClass]?.damage ?? 25;

  if ((entity.class as string) === 'archer') {
    effects.push({ type: 'arrow', fromId: entity.id, toId: target.id, fromTileX: entity.x, fromTileY: entity.y, toTileX: target.x, toTileY: target.y });
  } else {
    effects.push({ type: 'melee', fromId: entity.id, toId: target.id, fromTileX: entity.x, fromTileY: entity.y, toTileX: target.x, toTileY: target.y });
  }

  target.hp = Math.max(0, target.hp - eDmg);
  logger.log(`combat: entity=${entity.id} (${eClass}) dealt ${eDmg} dmg to target=${target.id} (${tClass}) hp=${target.hp}/${target.maxHp}`);

  if (target.type === 'barracks' && target.hp <= 0) {
    logger.log(`combat: entity=${entity.id} destroyed barracks=${target.id}`);
    return { killed: target.id };
  }

  if (target.hp <= 0) {
    logger.log(`combat: entity=${entity.id} (${eClass}) killed target=${target.id} (${tClass})`);
    return { killed: target.id };
  }

  const canRetaliate = eClass !== 'archer' && tClass !== 'archer';
  if (canRetaliate) {
    entity.hp = Math.max(0, entity.hp - tDmg);
    logger.log(`combat: target=${target.id} (${tClass}) retaliated ${tDmg} dmg to entity=${entity.id} (${eClass}) hp=${entity.hp}/${entity.maxHp}`);
    if (entity.hp <= 0) {
      if ((target.class as string) === 'archer') {
        effects.push({ type: 'arrow', fromId: target.id, toId: entity.id, fromTileX: target.x, fromTileY: target.y, toTileX: entity.x, toTileY: entity.y });
      } else {
        effects.push({ type: 'melee', fromId: target.id, toId: entity.id, fromTileX: target.x, fromTileY: target.y, toTileX: entity.x, toTileY: entity.y });
      }
      logger.log(`combat: entity=${entity.id} (${eClass}) killed by target retaliation`);
      return { killed: entity.id };
    }
  }

  return null;
}
