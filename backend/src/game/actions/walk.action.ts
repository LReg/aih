import { Logger } from '@nestjs/common';
import { Game, QueuedAction } from '../game';
import { resolveEntities } from '../algorithms/resolveEntities';
import { assignTargetsByDistance } from '../algorithms/getSpreadPositions';
import { isOverridable } from '../game-map';

const logger = new Logger('WalkAction');

interface WalkPayload { entityIds: string[]; x: number; y: number; positions: { x: number; y: number }[] }

export function walkAction(game: Game, action: QueuedAction): void {
  const payload = action.payload as WalkPayload;
  const entities = resolveEntities(game, payload.entityIds, action.playerId).filter(e => isOverridable(e.state.status));
  if (entities.length === 0) {
    logger.warn(`walk: no overridable entities`);
    return;
  }

  const order = assignTargetsByDistance(entities, payload.positions);

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    const t = payload.positions[order[i]] || { x: payload.x, y: payload.y };
    e.state = { status: 'moving', targetX: t.x, targetY: t.y };
    game.map.markChanged(e.id);
    e.lastCommand = 'move';
    logger.log(`walk: entity=${e.id} target=(${t.x},${t.y})`);
  }
}