import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { CountdownEvent, GameFoundEvent, GameState } from '../types/game.types';

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private matchSocket: Socket | null = null;
  private gameSocket: Socket | null = null;

  private tickSubject = new Subject<CountdownEvent>();
  private cancelledSubject = new Subject<string>();
  private requeuedSubject = new Subject<string>();
  private gameFoundSubject = new Subject<GameFoundEvent>();
  private stateUpdateSubject = new Subject<GameState>();

  countdownTick$: Observable<CountdownEvent> = this.tickSubject.asObservable();
  countdownCancelled$: Observable<string> = this.cancelledSubject.asObservable();
  requeued$: Observable<string> = this.requeuedSubject.asObservable();
  gameFound$: Observable<GameFoundEvent> = this.gameFoundSubject.asObservable();
  stateUpdate$: Observable<GameState> = this.stateUpdateSubject.asObservable();

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

  ngOnDestroy() {
    this.disconnectMatchmaking();
    this.disconnectGame();
    this.tickSubject.complete();
    this.cancelledSubject.complete();
    this.requeuedSubject.complete();
    this.gameFoundSubject.complete();
    this.stateUpdateSubject.complete();
  }
}
