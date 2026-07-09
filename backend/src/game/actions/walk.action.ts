import { Logger } from '@nestjs/common';
import { Game, QueuedAction } from '../game';
import { resolveEntities } from '../algorithms/resolveEntities';

const logger = new Logger('WalkAction');

interface WalkPayload { entityIds: string[]; x: number; y: number }

export function walkAction(game: Game, action: QueuedAction): void {
  const payload = action.payload as WalkPayload;
  const entities = resolveEntities(game, payload.entityIds, action.playerId);
  if (entities.length === 0) {
    logger.warn(`walk: no resolvable entities`);
    return;
  }

  for (const e of entities) {
    if (e.state.status === 'building-barracks') { continue; }
    e.state = { status: 'moving', targetX: payload.x, targetY: payload.y };
    e.lastCommand = 'move';
    logger.log(`walk: entity=${e.id} target=(${payload.x},${payload.y})`);
  }
}