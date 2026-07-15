import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription, first } from 'rxjs';
import { GameApiService } from '../../service/game-api.service';
import { ProfileApiService } from '../../service/profile-api.service';
import { SocketService } from '../../service/socket.service';
import { AuthService } from '../../service/auth/auth.service';
import { eloColor } from '../../util/elo';
import { GamemodeSelectComponent, GamemodeConfig, QueueState } from '../gamemode-select/gamemode-select.component';
import { QueueStatusComponent } from '../queue-status/queue-status.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [GamemodeSelectComponent, QueueStatusComponent, RouterLink],
  template: `
    <div class="lobby">
      <header class="lobby-header">
        <h1>Strat</h1>
        <div class="header-actions">
          @if (username && !authService.isLocalAuth()) {
            <a class="user-badge" routerLink="/profile">
              <span class="avatar" [style.background]="eloColor(elo ?? 1000)">{{ username[0].toUpperCase() }}</span>
              <span class="uname">{{ username }}</span>
              <span class="elo" [style.color]="eloColor(elo ?? 1000)">{{ elo ?? '...' }}</span>
            </a>
          } @else if (username) {
            <span class="user-badge">
              <span class="avatar" style="background:var(--accent)">{{ username[0].toUpperCase() }}</span>
              <span class="uname">{{ username }}</span>
            </span>
          }
          @if (authService.isLocalAuth()) {
            <button class="logout-btn" (click)="logout()">Logout</button>
          }
        </div>
      </header>

      @if (activeGameId) {
        <div class="active-game-banner" (click)="rejoinGame()">
          Active game in progress — click to rejoin
        </div>
      }

      <section class="content">
        <button class="create-lobby-btn" (click)="createLobby()">+ Create Lobby</button>

        <app-gamemode-select
          [state]="getQueueState('casual')" [config]="casualConfig"
          label="Casual" gamemode="casual" [queueCount]="queueCounts['casual'] || 0"
          (select)="joinQueue($event)"></app-gamemode-select>

        <app-gamemode-select
          [state]="getQueueState('massive')" [config]="massiveConfig"
          label="Massive" gamemode="massive" [queueCount]="queueCounts['massive'] || 0"
          (select)="joinQueue($event)"></app-gamemode-select>

        <app-gamemode-select
          [state]="getQueueState('slow')" [config]="slowConfig"
          label="Slow" gamemode="slow" [queueCount]="queueCounts['slow'] || 0"
          (select)="joinQueue($event)"></app-gamemode-select>

        @if (environment.baseUrl.includes('localhost')) {
          <app-gamemode-select
            [state]="getQueueState('test')" [config]="testConfig"
            label="Test" gamemode="test" [queueCount]="queueCounts['test'] || 0"
            (select)="joinQueue($event)"></app-gamemode-select>
        }

        <app-queue-status
          [queued]="queuedGamemode !== null"
          [seconds]="countdownSeconds"
          [playerCount]="countdownPlayerCount"
          [maxPlayers]="countdownMaxPlayers"
          (leave)="leaveQueue()"
        ></app-queue-status>
      </section>
    </div>
  `,
  styles: [`
    .lobby {
      max-width: 600px;
      margin: 0 auto;
      padding: 24px 16px env(safe-area-inset-bottom);
      min-height: 100dvh;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .lobby-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }
    h1 { margin: 0; font-size: 28px; color: var(--text-primary); }
    .header-actions { display: flex; align-items: center; gap: 12px; }
    .user-badge { display: flex; align-items: center; gap: 8px; background: var(--surface); padding: 6px 12px 6px 6px; border-radius: 20px; border: 1px solid var(--border); text-decoration: none; cursor: pointer; transition: border-color .15s; }
    .user-badge:hover { border-color: var(--accent); }
    .avatar { width: 28px; height: 28px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; flex-shrink: 0; }
    .uname { color: var(--text-primary); font-size: 14px; font-weight: 500; }
    .elo { font-size: 13px; font-weight: 700; }
    .logout-btn {
      padding: 10px 18px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 14px; min-height: 44px;
    }
    .logout-btn:hover { color: var(--danger); border-color: var(--danger); }
    .create-lobby-btn {
      padding: 14px; border: 2px dashed var(--accent); border-radius: 10px;
      background: transparent; color: var(--accent); font-size: 15px; font-weight: 600;
      cursor: pointer; text-align: center; transition: background .15s; min-height: 48px;
    }
    .create-lobby-btn:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
    .active-game-banner {
      padding: 16px; border: 2px solid var(--accent, #3b82f6); border-radius: 10px;
      background: color-mix(in srgb, var(--accent, #3b82f6) 12%, transparent);
      color: var(--accent, #3b82f6); font-size: 15px; font-weight: 600;
      text-align: center; cursor: pointer; transition: background .15s;
    }
    .active-game-banner:hover { background: color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent); }
    .content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
  `]
})
export class HomeComponent implements OnInit, OnDestroy {
  environment = environment;
  username = '';
  elo: number | null = null;
  eloColor = eloColor;
  queuedGamemode: string | null = null;
  countdownSeconds = 0;
  countdownPlayerCount = 0;
  countdownMaxPlayers = 0;
  queueCounts: Record<string, number> = {};
  activeGameId: string | null = null;
  casualConfig: GamemodeConfig = { maxPlayers: 5, mapWidth: 150, mapHeight: 150, tickRateMs: 1000 };
  massiveConfig: GamemodeConfig = { maxPlayers: 10, mapWidth: 400, mapHeight: 400, tickRateMs: 1000 };
  slowConfig: GamemodeConfig = { maxPlayers: 5, mapWidth: 100, mapHeight: 100, tickRateMs: 1500 };
  testConfig: GamemodeConfig = { maxPlayers: 5, mapWidth: 100, mapHeight: 100, tickRateMs: 150 };

  private getMaxPlayers(gamemode: string): number {
    switch (gamemode) {
      case 'casual': return this.casualConfig.maxPlayers;
      case 'massive': return this.massiveConfig.maxPlayers;
      case 'slow': return this.slowConfig.maxPlayers;
      case 'test': return this.testConfig.maxPlayers;
      default: return 0;
    }
  }

  getQueueState(gamemode: string): QueueState {
    if (this.countdownSeconds > 0 && this.queuedGamemode === gamemode) return 'countdown';
    if (this.queuedGamemode === gamemode) return 'queued';
    return 'idle';
  }

  private subs: Subscription[] = [];

  constructor(
    public authService: AuthService,
    private api: GameApiService,
    private profileApi: ProfileApiService,
    private socket: SocketService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.subs.push(
      this.authService.userId$().pipe(first()).subscribe(userId => {
        this.socket.connectMatchmaking(userId);
      }),
      this.authService.initialized.pipe(first(isInit => isInit)).subscribe(() => {
        this.profileApi.getMyProfile().subscribe({
          next: p => { this.username = p.username; this.elo = p.elo; },
          error: () => this.elo = null,
        });
      }),
      this.socket.countdownTick$.subscribe(e => {
        this.queuedGamemode = e.gamemode;
        this.countdownSeconds = e.seconds;
        this.countdownPlayerCount = e.playerIds.length;
        this.countdownMaxPlayers = this.getMaxPlayers(e.gamemode);
      }),
      this.socket.countdownCancelled$.subscribe(() => {
        this.queuedGamemode = null;
        this.countdownSeconds = 0;
        this.countdownPlayerCount = 0;
        this.countdownMaxPlayers = 0;
      }),
      this.socket.requeued$.subscribe(gamemode => {
        this.queuedGamemode = gamemode;
        this.countdownSeconds = 0;
        this.countdownPlayerCount = 0;
        this.countdownMaxPlayers = 0;
      }),
      this.api.getActiveGame().subscribe(r => {
        this.activeGameId = r.gameId;
      }),
      this.socket.gameFound$.subscribe(e => {
        this.router.navigate(['/game', e.gameId]);
      }),
      this.socket.queueUpdate$.subscribe(counts => {
        this.queueCounts = counts;
      }),
    );
  }

  joinQueue(gamemode: string) {
    if (this.queuedGamemode && this.queuedGamemode !== gamemode) {
      this.api.queueLeave(this.queuedGamemode).subscribe(() => {
        this.queuedGamemode = null;
        this.countdownSeconds = 0;
        this.api.queueJoin(gamemode).subscribe(() => {
          this.queuedGamemode = gamemode;
        });
      });
    } else if (!this.queuedGamemode) {
      this.api.queueJoin(gamemode).subscribe(() => {
        this.queuedGamemode = gamemode;
      });
    }
  }

  leaveQueue() {
    if (!this.queuedGamemode) return;
    this.api.queueLeave(this.queuedGamemode).subscribe(() => {
      this.queuedGamemode = null;
      this.countdownSeconds = 0;
      this.countdownPlayerCount = 0;
      this.countdownMaxPlayers = 0;
    });
  }

  rejoinGame() {
    if (this.activeGameId) this.router.navigate(['/game', this.activeGameId]);
  }

  createLobby() {
    this.api.createLobby().subscribe(res => {
      this.router.navigate(['/lobby', res.lobbyId]);
    });
  }

  logout() {
    this.socket.disconnectMatchmaking();
    this.authService.logout();
  }

  ngOnDestroy() {
    this.socket.disconnectMatchmaking();
    this.subs.forEach(s => s.unsubscribe());
  }
}
