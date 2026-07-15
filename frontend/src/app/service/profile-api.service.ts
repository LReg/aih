import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface MatchRecord {
  email: string;
  username: string;
  gameId: string;
  gamemode: string;
  placement: number;
  totalPlayers: number;
  eloDelta: number;
  eloBefore: number;
  eloAfter: number;
  timestamp: string;
}

export interface ProfileData {
  username: string;
  elo: number | null;
  gamesPlayed: number;
  wins: number;
  matchHistory: MatchRecord[];
}

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  constructor(private http: HttpClient) {}

  getMyProfile() {
    return this.http.get<ProfileData>(`${environment.apiUrl}/profile/me`);
  }

  getProfile(username: string) {
    return this.http.get<ProfileData>(`${environment.apiUrl}/profile/${encodeURIComponent(username)}`);
  }

  getProfileById(userId: string) {
    return this.http.get<ProfileData>(`${environment.apiUrl}/profile/by-id/${encodeURIComponent(userId)}`);
  }
}
