import type { Game } from './game';
import { lastSoldierStandingWinCondition } from './winConditions/lastSoldierStanding.winCondition';
import { timeLimitWinCondition } from './winConditions/timeLimit.winCondition';

export enum Gamemode {
  Casual = 'casual',
  Massive = 'massive',
  Slow = 'slow',
  Test = 'test',
}

export type WinCondition = (game: Game) => string[];

function composeWinConditions(...conditions: WinCondition[]): WinCondition {
  return (game) => {
    for (const condition of conditions) {
      const winners = condition(game);
      if (winners.length > 0) return winners;
    }
    return [];
  };
}

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
  archerAttackRange: number;
  archerDetectRange: number;
  soldierAttackBarracksKillChance: number;
  peaceDurationMs: number;
  startingSoldiers: number;
  maxBarracks: number;
  darknessRange: number;
  winCondition: WinCondition;
}

const DEFAULT_WIN_CONDITION = composeWinConditions(
  lastSoldierStandingWinCondition,
  timeLimitWinCondition,
);

export const GAMEMODE_CONFIGS: Record<string, GamemodeConfig> = {
  [Gamemode.Casual]: {
    maxPlayers: 5,
    startMinPlayers: 2,
    startTimerSeconds: 60,
    tickRateMs: 1000,
    maxDurationMs: 3600000,
    mapWidth: 150,
    mapHeight: 150,
    barracksBuildTime: 45,
    soldierProductionTime: 90,
    soldierMoveRange: 3,
    soldierAttackRange: 1,
    soldierDetectRange: 6,
    archerAttackRange: 5,
    archerDetectRange: 11,
    soldierAttackBarracksKillChance: 0.15,
    peaceDurationMs: 100000,
    startingSoldiers: 5,
    maxBarracks: 15,
    darknessRange: 10,
    winCondition: DEFAULT_WIN_CONDITION,
  },
  [Gamemode.Massive]: {
    maxPlayers: 10,
    startMinPlayers: 2,
    startTimerSeconds: 100,
    tickRateMs: 1000,
    maxDurationMs: 3600000,
    mapWidth: 400,
    mapHeight: 400,
    barracksBuildTime: 45,
    soldierProductionTime: 90,
    soldierMoveRange: 3,
    soldierAttackRange: 1,
    soldierDetectRange: 6,
    archerAttackRange: 5,
    archerDetectRange: 11,
    soldierAttackBarracksKillChance: 0.15,
    peaceDurationMs: 500000,
    startingSoldiers: 5,
    maxBarracks: 15,
    darknessRange: 10,
    winCondition: DEFAULT_WIN_CONDITION,
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
    soldierProductionTime: 100,
    soldierMoveRange: 3,
    soldierAttackRange: 1,
    soldierDetectRange: 6,
    archerAttackRange: 5,
    archerDetectRange: 11,
    soldierAttackBarracksKillChance: 0.15,
    peaceDurationMs: 700000,
    startingSoldiers: 5,
    maxBarracks: 15,
    darknessRange: 10,
    winCondition: DEFAULT_WIN_CONDITION,
  },
  [Gamemode.Test]: {
    maxPlayers: 5,
    startMinPlayers: 1,
    startTimerSeconds: 10,
    tickRateMs: 250,
    maxDurationMs: 3600000,
    mapWidth: 100,
    mapHeight: 100,
    barracksBuildTime: 15,
    soldierProductionTime: 25,
    soldierMoveRange: 3,
    soldierAttackRange: 1,
    soldierDetectRange: 6,
    archerAttackRange: 5,
    archerDetectRange: 11,
    soldierAttackBarracksKillChance: 0.15,
    peaceDurationMs: 10000,
    startingSoldiers: 5,
    maxBarracks: 15,
    darknessRange: 10,
    winCondition: DEFAULT_WIN_CONDITION,
  },
};
