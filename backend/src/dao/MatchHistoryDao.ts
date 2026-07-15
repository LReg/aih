import { Db } from 'mongodb';

export interface MatchRecord {
  userId: string;
  username: string;
  gameId: string;
  gamemode: string;
  placement: number;
  totalPlayers: number;
  eloDelta: number;
  eloBefore: number;
  eloAfter: number;
  timestamp: Date;
}

export async function getMatchHistory(db: Db, userId: string, limit = 20): Promise<MatchRecord[]> {
  return db.collection<MatchRecord>('match_history')
    .find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

export async function saveMatchRecord(db: Db, record: MatchRecord): Promise<void> {
  await db.collection<MatchRecord>('match_history').insertOne(record);
}
