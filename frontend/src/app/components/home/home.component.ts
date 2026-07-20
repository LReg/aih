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

        <div class="world-card" (click)="joinWorld()">
          <div class="world-glow"></div>
          <div class="world-inner">
            <div class="world-icon-row">
              <div class="world-icon"><span class="world-icon-text">W</span></div>
              <span class="world-badge">BETA</span>
            </div>
            <div class="world-player-badge">
              <span class="world-player-dot"></span>
              <span>{{ worldPlayers }}</span>
            </div>
            <div class="world-info">
              <div class="world-label">World Mode</div>
              <div class="world-desc">Jump in anytime &mdash; a living map where players come and go. Build, fight, rise, repeat</div>
            </div>
            <div class="world-divider"></div>
            <div class="world-stats">
              <div class="world-stat">
                <span class="world-stat-value">500×500</span>
                <span class="world-stat-label">Map</span>
              </div>
              <div class="world-stat-sep"></div>
              <div class="world-stat">
                <span class="world-stat-value">20</span>
                <span class="world-stat-label">Players</span>
              </div>
              <div class="world-stat-sep"></div>
              <div class="world-stat">
                <span class="world-stat-value">1s</span>
                <span class="world-stat-label">Tick</span>
              </div>
            </div>
            <div class="world-action">JOIN WORLD</div>
          </div>
        </div>

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
    .world-card {
      position: relative;
      border-radius: 14px;
      overflow: hidden;
      cursor: pointer;
      transition: transform .2s, box-shadow .2s;
    }
    .world-card:hover { transform: translateY(-2px); }
    .world-glow {
      position: absolute;
      inset: -2px;
      background: conic-gradient(from 0deg, #a78bfa, #60a5fa, #34d399, #a78bfa);
      animation: worldSpin 4s linear infinite;
    }
    @keyframes worldSpin { to { rotate: 360deg; } }
    .world-inner {
      position: relative;
      margin: 2px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(15,23,42,.96), rgba(30,41,59,.96));
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .world-player-badge {
      position: absolute;
      top: 14px;
      right: 14px;
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px 3px 8px;
      border-radius: 20px;
      background: rgba(52,211,153,.12);
      color: #34d399;
      font-size: 12px;
      font-weight: 700;
    }
    .world-player-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #34d399;
      animation: worldPulse 2s ease-in-out infinite;
    }
    @keyframes worldPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .35; }
    }
    .world-icon-row { display: flex; align-items: center; gap: 10px; }
    .world-icon {
      width: 46px; height: 46px; border-radius: 12px;
      background: linear-gradient(135deg, #a78bfa, #7c3aed);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 0 20px rgba(124,58,237,.4);
    }
    .world-icon-text { color: #fff; font-size: 22px; font-weight: 800; }
    .world-badge {
      padding: 2px 10px; border-radius: 4px;
      background: rgba(167,139,250,.15); color: #a78bfa;
      font-size: 10px; font-weight: 700; letter-spacing: 1.5px;
    }
    .world-info { flex: 1; min-width: 0; }
    .world-label { font-weight: 700; font-size: 18px; color: #f1f5f9; letter-spacing: -.3px; }
    .world-desc { font-size: 13px; color: #94a3b8; margin-top: 3px; line-height: 1.4; }
    .world-divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(167,139,250,.3), transparent); }
    .world-stats { display: flex; align-items: center; justify-content: center; gap: 0; padding: 2px 0; }
    .world-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; }
    .world-stat-value { font-size: 16px; font-weight: 700; color: #e2e8f0; }
    .world-stat-label { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
    .world-stat-sep { width: 1px; height: 28px; background: rgba(167,139,250,.15); }
    .world-action {
      padding: 12px; border-radius: 8px; border: none;
      background: linear-gradient(135deg, #a78bfa, #7c3aed);
      color: #fff; font-weight: 700; font-size: 14px; letter-spacing: .5px;
      text-align: center; cursor: pointer;
      transition: opacity .15s, box-shadow .2s;
      box-shadow: 0 0 16px rgba(124,58,237,.25);
    }
    .world-action:hover { opacity: .92; box-shadow: 0 0 24px rgba(124,58,237,.45); }
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
  worldPlayers = 0;
  private worldStatusInterval: ReturnType<typeof setInterval> | null = null;
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

    this.fetchWorldStatus();
    this.worldStatusInterval = setInterval(() => this.fetchWorldStatus(), 15000);
  }

  private fetchWorldStatus() {
    this.api.getWorldStatus().subscribe(s => this.worldPlayers = s.activePlayers);
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

  joinWorld() {
    this.api.worldJoin().subscribe(res => {
      this.router.navigate(['/game', res.gameId]);
    });
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
    if (this.worldStatusInterval) clearInterval(this.worldStatusInterval);
    this.socket.disconnectMatchmaking();
    this.subs.forEach(s => s.unsubscribe());
  }
}
