import { Logger } from '@nestjs/common';
import { Game, QueuedAction } from '../game';
import { createBarracks } from '../game-map';

const logger = new Logger('BuildBarracksAction');

interface BuildPayload { entityIds: string[] }

export function buildBarracksAction(game: Game, action: QueuedAction): void {
  const payload = action.payload as BuildPayload;
  for (const entityId of payload.entityIds) {
    const entity = game.map.entities.get(entityId);
    if (!entity) { logger.warn(`build: entity=${entityId} not found`); continue; }
    if (entity.ownerId !== action.playerId) { logger.warn(`build: entity=${entityId} owner mismatch`); continue; }
    if (entity.type !== 'soldier') { logger.warn(`build: entity=${entityId} not soldier`); continue; }
    if (entity.state.status === 'building-barracks') { continue; }

    const adj = game.map.findNearestEmptyTileAvoidBarracks(entity.x, entity.y);
    if (!adj) { logger.warn(`build: entity=${entityId} no valid tile (need 1-tile gap from barracks)`); continue; }

    entity.state = { status: 'building-barracks', startedAtTick: game.tick };
    game.map.markChanged(entity.id);
    const barracks = createBarracks(action.playerId, adj.x, adj.y, game.tick);
    game.map.addEntity(barracks);
    logger.log(`build: entity=${entityId} barracks=${barracks.id} at (${adj.x},${adj.y})`);
  }
}