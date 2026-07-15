import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { ActionResponse, GameState, LobbyData, LobbySettings } from '../types/game.types';

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

  getEloGame(gameId: string) {
    return this.http.get<{ eloGame: boolean }>(`${environment.apiUrl}/game/${gameId}/elo`);
  }

  getActiveGame() {
    return this.http.get<{ gameId: string | null }>(`${environment.apiUrl}/game/active`);
  }

  register(email: string, name: string, password: string) {
    return this.http.post<{ success: boolean; message: string }>(`${environment.apiUrl}/auth/register`, { email, name, password });
  }

  createLobby(settings?: Partial<LobbySettings>) {
    return this.http.post<{ lobbyId: string }>(`${environment.apiUrl}/lobby`, { settings });
  }

  getLobby(lobbyId: string) {
    return this.http.get<LobbyData>(`${environment.apiUrl}/lobby/${lobbyId}`);
  }

  joinLobby(lobbyId: string) {
    return this.http.post<{ joined: boolean }>(`${environment.apiUrl}/lobby/${lobbyId}/join`, {});
  }

  leaveLobby(lobbyId: string) {
    return this.http.post<{ left: boolean }>(`${environment.apiUrl}/lobby/${lobbyId}/leave`, {});
  }

  startLobbyGame(lobbyId: string) {
    return this.http.post<{ gameId: string }>(`${environment.apiUrl}/lobby/${lobbyId}/start`, {});
  }

  cancelLobby(lobbyId: string) {
    return this.http.delete<{ cancelled: boolean }>(`${environment.apiUrl}/lobby/${lobbyId}`);
  }

  updateLobbySettings(lobbyId: string, settings: Partial<LobbySettings>) {
    return this.http.patch<{ updated: boolean }>(`${environment.apiUrl}/lobby/${lobbyId}/settings`, settings);
  }
}
