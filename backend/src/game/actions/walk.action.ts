import { Logger } from '@nestjs/common';
import { Game, QueuedAction } from '../game';
import { resolveEntities } from '../algorithms/resolveEntities';
import { getSpreadPositions } from '../algorithms/getSpreadPositions';

const logger = new Logger('WalkAction');

interface WalkPayload { entityIds: string[]; x: number; y: number }

export function walkAction(game: Game, action: QueuedAction): void {
  const payload = action.payload as WalkPayload;
  const entities = resolveEntities(game, payload.entityIds, action.playerId);
  if (entities.length === 0) {
    logger.warn(`walk: no resolvable entities`);
    return;
  }

  const targets = getSpreadPositions(
    payload.x, payload.y, entities.length,
    (x, y) => game.map.isTileEmpty(x, y),
    game.map.width, game.map.height,
  );

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.state.status === 'building-barracks') { continue; }
    const t = targets[i] || { x: payload.x, y: payload.y };
    e.state = { status: 'moving', targetX: t.x, targetY: t.y };
    game.map.markChanged(e.id);
    e.lastCommand = 'move';
    logger.log(`walk: entity=${e.id} target=(${t.x},${t.y})`);
  }
}