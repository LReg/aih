import { Logger } from '@nestjs/common';
import { Game, QueuedAction } from '../game';
import { resolveEntities } from '../algorithms/resolveEntities';
import { getSpreadPositions } from '../algorithms/getSpreadPositions';
import { isPeaceTime } from '../algorithms/isPeaceTime';
import { isOverridable } from '../game-map';

const logger = new Logger('AttackAction');

interface AttackPayload { entityIds: string[]; x: number; y: number }

export function attackAction(game: Game, action: QueuedAction): void {
  if (isPeaceTime(game)) {
    logger.warn(`attack rejected during peace time game=${game.id}`);
    return;
  }
  const payload = action.payload as AttackPayload;
  const entities = resolveEntities(game, payload.entityIds, action.playerId).filter(e => isOverridable(e.state.status));
  if (entities.length === 0) {
    logger.warn(`attack: no overridable entities`);
    return;
  }

  const targets = getSpreadPositions(
    payload.x, payload.y, entities.length,
    (x, y) => game.map.isTilePassableForMove(x, y, action.playerId),
    game.map.width, game.map.height,
  );

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    entity.lockedTargetId = undefined;
    entity.path = undefined;
    const t = targets[i] || { x: payload.x, y: payload.y };
    entity.state = { status: 'attacking', targetX: t.x, targetY: t.y };
    game.map.markChanged(entity.id);
    entity.lastCommand = 'attack';
    logger.log(`attack: entity=${entity.id} target=(${t.x},${t.y})`);
  }
}

