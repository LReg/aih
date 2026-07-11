import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { CountdownEvent, GameFoundEvent, GameState, StateUpdate, LobbyData, LobbyStartedEvent } from '../types/game.types';

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private matchSocket: Socket | null = null;
  private gameSocket: Socket | null = null;
  private lobbySocket: Socket | null = null;

  private tickSubject = new Subject<CountdownEvent>();
  private cancelledSubject = new Subject<string>();
  private requeuedSubject = new Subject<string>();
  private gameFoundSubject = new Subject<GameFoundEvent>();
  private stateUpdateSubject = new Subject<StateUpdate>();
  private lobbyUpdateSubject = new Subject<LobbyData>();
  private lobbyStartedSubject = new Subject<LobbyStartedEvent>();
  private lobbyCancelledSubject = new Subject<{ lobbyId: string }>();

  countdownTick$: Observable<CountdownEvent> = this.tickSubject.asObservable();
  countdownCancelled$: Observable<string> = this.cancelledSubject.asObservable();
  requeued$: Observable<string> = this.requeuedSubject.asObservable();
  gameFound$: Observable<GameFoundEvent> = this.gameFoundSubject.asObservable();
  stateUpdate$: Observable<StateUpdate> = this.stateUpdateSubject.asObservable();
  lobbyUpdate$: Observable<LobbyData> = this.lobbyUpdateSubject.asObservable();
  lobbyStarted$: Observable<LobbyStartedEvent> = this.lobbyStartedSubject.asObservable();
  lobbyCancelled$: Observable<{ lobbyId: string }> = this.lobbyCancelledSubject.asObservable();

  private readonly socketPath = environment.apiUrl.endsWith('/api') ? '/api/socket.io' : '/socket.io';

  get socketHost(): string {
    return environment.apiUrl.replace(/\/api$/, '');
  }

  connectMatchmaking(userId: string) {
    if (this.matchSocket?.connected) return;
    this.matchSocket = io(`${this.socketHost}/matchmaking`, {
      path: this.socketPath,
      transports: ['websocket'],
      auth: { userId },
    });

    this.matchSocket.on('countdownTick', (data: CountdownEvent) => {
      this.tickSubject.next(data);
    });

    this.matchSocket.on('countdownCancelled', (data: { gamemode: string }) => {
      this.cancelledSubject.next(data.gamemode);
    });

    this.matchSocket.on('requeued', (data: { gamemode: string }) => {
      this.requeuedSubject.next(data.gamemode);
    });

    this.matchSocket.on('gameFound', (data: GameFoundEvent) => {
      this.gameFoundSubject.next(data);
    });
  }

  disconnectMatchmaking() {
    this.matchSocket?.disconnect();
    this.matchSocket = null;
  }

  connectGame() {
    if (this.gameSocket?.connected) return;
    this.gameSocket = io(`${this.socketHost}/game`, { path: this.socketPath, transports: ['websocket'] });

    this.gameSocket.on('stateUpdate', (data: GameState) => {
      this.stateUpdateSubject.next(data);
    });
  }

  disconnectGame() {
    this.gameSocket?.disconnect();
    this.gameSocket = null;
  }

  joinGameRoom(gameId: string) {
    this.gameSocket?.emit('joinGame', gameId);
  }

  leaveGameRoom(gameId: string) {
    this.gameSocket?.emit('leaveGame', gameId);
  }

  connectLobby(userId: string) {
    if (this.lobbySocket?.connected) return;
    this.lobbySocket = io(`${this.socketHost}/lobby`, {
      path: this.socketPath,
      transports: ['websocket'],
      auth: { userId },
    });

    this.lobbySocket.on('lobbyUpdate', (data: LobbyData) => {
      this.lobbyUpdateSubject.next(data);
    });

    this.lobbySocket.on('lobbyStarted', (data: LobbyStartedEvent) => {
      this.lobbyStartedSubject.next(data);
    });

    this.lobbySocket.on('lobbyCancelled', (data: { lobbyId: string }) => {
      this.lobbyCancelledSubject.next(data);
    });
  }

  disconnectLobby() {
    this.lobbySocket?.disconnect();
    this.lobbySocket = null;
  }

  joinLobbyRoom(lobbyId: string) {
    this.lobbySocket?.emit('joinLobby', lobbyId);
  }

  leaveLobbyRoom(lobbyId: string) {
    this.lobbySocket?.emit('leaveLobby', lobbyId);
  }

  ngOnDestroy() {
    this.disconnectMatchmaking();
    this.disconnectGame();
    this.disconnectLobby();
    this.tickSubject.complete();
    this.cancelledSubject.complete();
    this.requeuedSubject.complete();
    this.gameFoundSubject.complete();
    this.stateUpdateSubject.complete();
    this.lobbyUpdateSubject.complete();
    this.lobbyStartedSubject.complete();
    this.lobbyCancelledSubject.complete();
  }
}
