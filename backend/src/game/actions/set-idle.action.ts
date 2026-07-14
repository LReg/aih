import { Logger } from '@nestjs/common';
import { Game, QueuedAction } from '../game';
import { resolveEntities } from '../algorithms/resolveEntities';
import { isOverridable } from '../game-map';

const logger = new Logger('SetIdleAction');

interface SetIdlePayload { entityIds: string[] }

export function setIdleAction(game: Game, action: QueuedAction): void {
  const payload = action.payload as SetIdlePayload;
  const entities = resolveEntities(game, payload.entityIds, action.playerId).filter(e => isOverridable(e.state.status));
  if (entities.length === 0) {
    logger.warn(`set_idle: no overridable entities`);
    return;
  }

  for (const e of entities) {
    e.state = { status: 'idle' };
    e.path = undefined;
    e.pathIndex = undefined;
    e.lockedTargetId = undefined;
    game.map.markChanged(e.id);
    e.lastCommand = 'idle';
    logger.log(`set_idle: entity=${e.id}`);
  }
}
