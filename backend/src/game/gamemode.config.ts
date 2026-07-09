import type { Game } from './game';

export enum Gamemode {
  Casual = 'casual',
  Massive = 'massive',
  Slow = 'slow',
}

export type WinCondition = (game: Game) => string[];

export interface GamemodeConfig {
  maxPlayers: number;
  startMinPlayers?: number;
  startTimerSeconds: number;
  tickRateMs: number;
  maxDurationMs: number;
  mapWidth: number;
  mapHeight: number;
  barracksBuildTime: number;
  soldierProductionTime: number;
  soldierMoveRange: number;
  soldierAttackRange: number;
  soldierDetectRange: number;
  soldierAttackBarracksKillChance: number;
  winCondition: WinCondition;
}

export const GAMEMODE_CONFIGS: Record<Gamemode, GamemodeConfig> = {
  [Gamemode.Casual]: {
    maxPlayers: 5,
    startMinPlayers: 2,
    startTimerSeconds: 60,
    tickRateMs: 500,
    maxDurationMs: 3600000,
    mapWidth: 100,
    mapHeight: 100,
    barracksBuildTime: 60,
    soldierProductionTime: 60,
    soldierMoveRange: 3,
    soldierAttackRange: 1,
    soldierDetectRange: 5,
    soldierAttackBarracksKillChance: 0.25,
    winCondition: (game) => {
      const alive = new Set<string>();
      for (const entity of game.map.entities.values()) {
        if (entity.type === 'soldier') alive.add(entity.ownerId);
      }
      if (alive.size === 1) return [alive.values().next().value as string];
      return [];
    },
  },
  [Gamemode.Massive]: {
    maxPlayers: 10,
    startMinPlayers: 2,
    startTimerSeconds: 100,
    tickRateMs: 500,
    maxDurationMs: 3600000,
    mapWidth: 400,
    mapHeight: 400,
    barracksBuildTime: 60,
    soldierProductionTime: 60,
    soldierMoveRange: 3,
    soldierAttackRange: 1,
    soldierDetectRange: 5,
    soldierAttackBarracksKillChance: 0.25,
    winCondition: (game) => {
      const alive = new Set<string>();
      for (const entity of game.map.entities.values()) {
        if (entity.type === 'soldier') alive.add(entity.ownerId);
      }
      if (alive.size === 1) return [alive.values().next().value as string];
      return [];
    },
  },
  [Gamemode.Slow]: {
    maxPlayers: 5,
    startMinPlayers: 2,
    startTimerSeconds: 100,
    tickRateMs: 1500,
    maxDurationMs: 3600000,
    mapWidth: 100,
    mapHeight: 100,
    barracksBuildTime: 60,
    soldierProductionTime: 60,
    soldierMoveRange: 3,
    soldierAttackRange: 1,
    soldierDetectRange: 5,
    soldierAttackBarracksKillChance: 0.25,
    winCondition: (game) => {
      const alive = new Set<string>();
      for (const entity of game.map.entities.values()) {
        if (entity.type === 'soldier') alive.add(entity.ownerId);
      }
      if (alive.size === 1) return [alive.values().next().value as string];
      return [];
    },
  },
};
