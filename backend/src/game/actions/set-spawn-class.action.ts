import { Logger } from '@nestjs/common';
import { Game, QueuedAction } from '../game';
import { SoldierClass } from '../game-map';

const logger = new Logger('SetSpawnClassAction');

interface SetSpawnClassPayload { entityIds: string[]; spawnClass: SoldierClass }

export function setSpawnClassAction(game: Game, action: QueuedAction): void {
  const payload = action.payload as SetSpawnClassPayload;
  const validClasses: SoldierClass[] = ['soldier', 'archer', 'tank'];
  if (!validClasses.includes(payload.spawnClass)) {
    logger.warn(`set_spawn_class: invalid class=${payload.spawnClass}`);
    return;
  }

  for (const entityId of payload.entityIds) {
    const entity = game.map.entities.get(entityId);
    if (!entity) { logger.warn(`set_spawn_class: entity=${entityId} not found`); continue; }
    if (entity.ownerId !== action.playerId) { logger.warn(`set_spawn_class: entity=${entityId} owner mismatch`); continue; }
    if (entity.type !== 'barracks') { logger.warn(`set_spawn_class: entity=${entityId} not barracks`); continue; }

    if (entity.state.status === 'ready') {
      const s = entity.state as { status: 'ready'; lastProducedAtTick: number; spawnClass?: SoldierClass };
      s.spawnClass = payload.spawnClass;
      game.map.markChanged(entity.id);
      logger.log(`set_spawn_class: barracks=${entityId} class=${payload.spawnClass}`);
    } else if (entity.state.status === 'building') {
      const s = entity.state as { status: 'building'; startedAtTick: number; spawnClass?: SoldierClass };
      s.spawnClass = payload.spawnClass;
      game.map.markChanged(entity.id);
      logger.log(`set_spawn_class: barracks=${entityId} class=${payload.spawnClass}`);
    }
  }
}
