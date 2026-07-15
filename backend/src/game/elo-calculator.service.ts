import { Injectable } from '@nestjs/common';

const K_FACTOR = 32;

interface EloPlayer {
  username: string;
  elo: number;
}

interface EloResult {
  username: string;
  eloDelta: number;
  eloBefore: number;
  eloAfter: number;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

@Injectable()
export class EloCalculator {
  calculate(players: EloPlayer[], placements: string[]): EloResult[] {
    const n = players.length;
    if (n < 2) return [];

    const eloMap = new Map(players.map(p => [p.username, p.elo]));
    const results: EloResult[] = [];

    for (let i = 0; i < n; i++) {
      const username = placements[i];
      const rating = eloMap.get(username);
      if (rating === undefined) continue;

      let expectedTotal = 0;
      let opponents = 0;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const oppRating = eloMap.get(placements[j]);
        if (oppRating === undefined) continue;
        expectedTotal += expectedScore(rating, oppRating);
        opponents++;
      }

      if (opponents === 0) {
        results.push({ username, eloDelta: 0, eloBefore: rating, eloAfter: rating });
        continue;
      }

      const expectedAvg = expectedTotal / opponents;
      const score = i / (n - 1);
      const delta = Math.round(K_FACTOR * (score - expectedAvg));

      results.push({ username, eloDelta: delta, eloBefore: rating, eloAfter: rating + delta });
    }

    return results;
  }
}
