import { Db } from 'mongodb';

export interface PlayerProfile {
  userId: string;
  username: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  updatedAt: Date;
}

export async function getProfile(db: Db, userId: string): Promise<PlayerProfile | null> {
  return db.collection<PlayerProfile>('player_profile').findOne({ userId });
}

export async function upsertProfile(db: Db, userId: string, username: string, update: Partial<PlayerProfile>): Promise<void> {
  await db.collection<PlayerProfile>('player_profile').updateOne(
    { userId },
    { $set: { ...update, userId, username, updatedAt: new Date() } },
    { upsert: true },
  );
}
