import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { ActionResponse, GameState } from '../types/game.types';

@Injectable({ providedIn: 'root' })
export class GameApiService {
  constructor(private http: HttpClient) {}

  queueJoin(gamemode: string) {
    return this.http.post<{ queued: boolean }>(`${environment.apiUrl}/queue/join`, { gamemode });
  }

  queueLeave(gamemode: string) {
    return this.http.post<{ left: boolean }>(`${environment.apiUrl}/queue/leave`, { gamemode });
  }

  submitAction(gameId: string, type: string, payload: unknown) {
    return this.http.post<ActionResponse>(`${environment.apiUrl}/game/${gameId}/action`, { type, payload });
  }

  getGame(gameId: string) {
    return this.http.get<GameState>(`${environment.apiUrl}/game/${gameId}`);
  }
}
