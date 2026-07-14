import { Logger } from '@nestjs/common';
import { Entity } from '../game-map';
import type { Effect } from '../game';

const logger = new Logger('ResolveEntityCombat');

interface CombatOdds {
  kills: number;
  dies: number;
}

const COMBAT_TABLE: Record<string, Record<string, CombatOdds>> = {
  soldier: {
    soldier: { kills: 0.3, dies: 0.3 },
    archer: { kills: 0.4, dies: 0.125 },
    tank: { kills: 0.05, dies: 0.05 }
  },
  archer: {
    soldier: { kills: 0.20, dies: 0 },
    tank: { kills: 0.05, dies: 0 },
    archer: { kills: 0.30, dies: 0 },
  },
  tank: {
    soldier: { kills: 0.05, dies: 0.05 },
    archer: { kills: 0.15, dies: 0.05 },
    tank: { kills: 0.05, dies: 0.05 },
  },
};

function getOdds(e: Entity, t: Entity): CombatOdds {
  const eClass = (e.class as string) || 'soldier';
  const tClass = (t.class as string) || 'soldier';
  return COMBAT_TABLE[eClass]?.[tClass] ?? { kills: 0.5, dies: 0.5 };
}

export function resolveEntityCombat(
  entity: Entity,
  target: Entity,
  barracksKillChance: number,
  effects: Effect[],
): { killed: string } | null {
  if (target.type === 'barracks') {
    if (Math.random() < barracksKillChance) {
      logger.log(`combat: entity=${entity.id} destroyed barracks=${target.id}`);
      return { killed: target.id };
    }
    logger.log(`combat: entity=${entity.id} failed to destroy barracks=${target.id}`);
    return null;
  }

  if ((entity.class as string) === 'archer') {
    effects.push({ type: 'arrow', fromId: entity.id, toId: target.id, fromTileX: entity.x, fromTileY: entity.y, toTileX: target.x, toTileY: target.y });
  } else {
    effects.push({ type: 'melee', fromId: entity.id, toId: target.id, fromTileX: entity.x, fromTileY: entity.y, toTileX: target.x, toTileY: target.y });
  }

  const odds = getOdds(entity, target);
  const roll = Math.random();
  const total = odds.kills + odds.dies;

  if (roll < odds.kills) {
    logger.log(`combat: entity=${entity.id} (${entity.class || 'soldier'}) killed target=${target.id} (${target.class || 'soldier'})`);
    return { killed: target.id };
  }

  if (total > 0 && roll < total) {
    if ((target.class as string) === 'archer') {
      effects.push({ type: 'arrow', fromId: target.id, toId: entity.id, fromTileX: target.x, fromTileY: target.y, toTileX: entity.x, toTileY: entity.y });
    } else {
      effects.push({ type: 'melee', fromId: target.id, toId: entity.id, fromTileX: target.x, fromTileY: target.y, toTileX: entity.x, toTileY: entity.y });
    }
    logger.log(`combat: entity=${entity.id} (${entity.class || 'soldier'}) killed by target=${target.id} (${target.class || 'soldier'})`);
    return { killed: entity.id };
  }

  logger.log(`combat: entity=${entity.id} (${entity.class || 'soldier'}) standoff vs target=${target.id} (${target.class || 'soldier'})`);
  return null;
}
