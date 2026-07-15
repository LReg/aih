import { Controller, Get, Param, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { getProfile } from '../dao/PlayerProfileDao';
import { getMatchHistory } from '../dao/MatchHistoryDao';
import { getUserByPreferredUsername, getUserById } from '../dao/UserDao';

@Controller('profile')
export class ProfileController {
  constructor(private db: DatabaseService) {}

  @Get('me')
  async getMyProfile(@Req() req: Request) {
    const user = (req as any).user;
    if (!user?.userId) throw new UnauthorizedException();
    return this.getProfileData(user.userId, user.preferredUsername || '');
  }

  @Get('by-id/:userId')
  async getProfileByUserId(@Param('userId') userId: string) {
    const user = await getUserById(this.db.db, userId);
    const displayName = user?.preferredUsername || userId;
    return this.getProfileData(userId, displayName);
  }

  @Get(':username')
  async getProfileByUsername(@Param('username') username: string) {
    const user = await getUserByPreferredUsername(this.db.db, username);
    if (!user?.userId) {
      return { username, elo: null, gamesPlayed: 0, wins: 0, matchHistory: [] };
    }
    return this.getProfileData(user.userId, user.preferredUsername || username);
  }

  private async getProfileData(userId: string, displayName: string) {
    if (!this.db.db) return { username: displayName, elo: null, gamesPlayed: 0, wins: 0, matchHistory: [] };
    const profile = await getProfile(this.db.db, userId);
    const history = await getMatchHistory(this.db.db, userId);
    return {
      username: displayName,
      elo: profile?.elo ?? null,
      gamesPlayed: profile?.gamesPlayed ?? 0,
      wins: profile?.wins ?? 0,
      matchHistory: history,
    };
  }
}
