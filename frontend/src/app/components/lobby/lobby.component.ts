import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, first } from 'rxjs';
import { GameApiService } from '../../service/game-api.service';
import { SocketService } from '../../service/socket.service';
import { AuthService } from '../../service/auth/auth.service';
import { LobbyData, LobbySettings } from '../../types/game.types';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-lobby',
  standalone: true,
  template: `
    <div class="lobby-page">
      <header class="topbar">
        <span class="topbar-title">Strat</span>
        <button class="topbar-back" (click)="leave()">&larr; Back</button>
      </header>

      <main class="lobby-body">
        <!-- INVITE CARD -->
        <section class="card invite-card">
          <div class="card-icon">&#9993;</div>
          <div class="card-body">
            <h2>Invite Players</h2>
            <p class="card-sub">Share this link so others can join your game</p>
            <div class="invite-row">
              <input class="invite-input" [value]="inviteUrl" readonly (click)="selectInvite($event)" />
              <button class="btn-copy" [class.copied]="copied" (click)="copyInvite()">
                @if (copied) { Copied } @else { Copy }
              </button>
            </div>
          </div>
        </section>

        <!-- PLAYERS CARD -->
        <section class="card players-card">
          <div class="card-header-row">
            <h2>Players</h2>
            <span class="player-count">{{ lobby?.players?.length || 0 }} / {{ lobby?.settings?.maxPlayers || '?' }}</span>
          </div>
          <div class="player-list">
            @for (p of lobby?.players; track p) {
              <div class="player-row" [class.is-host]="p === lobby?.hostId">
                <div class="player-avatar" [class.host-avatar]="p === lobby?.hostId">
                  {{ p.charAt(0).toUpperCase() }}
                </div>
                <span class="player-name">{{ p }}</span>
                @if (p === lobby?.hostId) {
                  <span class="host-badge">Host</span>
                }
              </div>
            }
          </div>
        </section>

        <!-- SETTINGS CARD -->
        <section class="card settings-card">
          <div class="card-header-row">
            <h2>Game Settings</h2>
            @if (!isHost) {
              <span class="readonly-hint">View only</span>
            }
          </div>
          <div class="settings-grid">
            <div class="setting-field">
              <label>Max Players</label>
              @if (isHost) {
                <input type="number" min="2" max="10" [value]="lobby?.settings?.maxPlayers"
                  (change)="updateSetting('maxPlayers', +$any($event.target).value)" />
              } @else {
                <span class="setting-val">{{ lobby?.settings?.maxPlayers }}</span>
              }
            </div>
            <div class="setting-field">
              <label>Map Size</label>
              @if (isHost) {
                <div class="setting-row">
                  <input type="number" min="50" max="400" step="50" [value]="lobby?.settings?.mapWidth"
                    (change)="updateSetting('mapWidth', +$any($event.target).value)" title="Width" />
                  <span class="setting-times">&times;</span>
                  <input type="number" min="50" max="400" step="50" [value]="lobby?.settings?.mapHeight"
                    (change)="updateSetting('mapHeight', +$any($event.target).value)" title="Height" />
                </div>
              } @else {
                <span class="setting-val">{{ lobby?.settings?.mapWidth }} &times; {{ lobby?.settings?.mapHeight }}</span>
              }
            </div>
            <div class="setting-field">
              <label>Tick Rate</label>
              @if (isHost) {
                <select [value]="lobby?.settings?.tickRateMs"
                  (change)="updateSetting('tickRateMs', +$any($event.target).value)">
                  <option value="500">500ms &mdash; Fast</option>
                  <option value="1500">1500ms &mdash; Slow</option>
                  <option value="2000">2000ms &mdash; Very Slow</option>
                </select>
              } @else {
                <span class="setting-val">{{ lobby?.settings?.tickRateMs }}ms</span>
              }
            </div>
            <div class="setting-field">
              <label>Peace Duration</label>
              @if (isHost) {
                <select [value]="lobby?.settings?.peaceDurationMs"
                  (change)="updateSetting('peaceDurationMs', +$any($event.target).value)">
                  <option [value]="30000">30s</option>
                  <option [value]="60000">60s</option>
                  <option [value]="120000">2 min</option>
                  <option [value]="300000">5 min</option>
                </select>
              } @else {
                <span class="setting-val">{{ (lobby?.settings?.peaceDurationMs || 0) / 1000 }}s</span>
              }
            </div>
            <div class="setting-field">
              <label>Starting Soldiers</label>
              @if (isHost) {
                <input type="number" min="1" max="20" [value]="lobby?.settings?.startingSoldiers"
                  (change)="updateSetting('startingSoldiers', +$any($event.target).value)" />
              } @else {
                <span class="setting-val">{{ lobby?.settings?.startingSoldiers }}</span>
              }
            </div>
            <div class="setting-field">
              <label>Max Barracks</label>
              @if (isHost) {
                <input type="number" min="1" max="50" [value]="lobby?.settings?.maxBarracks"
                  (change)="updateSetting('maxBarracks', +$any($event.target).value)" />
              } @else {
                <span class="setting-val">{{ lobby?.settings?.maxBarracks }}</span>
              }
            </div>
            <div class="setting-field">
              <label>Darkness Range</label>
              @if (isHost) {
                <input type="number" min="0" max="50" [value]="lobby?.settings?.darknessRange"
                  (change)="updateSetting('darknessRange', +$any($event.target).value)" />
              } @else {
                <span class="setting-val">{{ lobby?.settings?.darknessRange }}</span>
              }
            </div>
          </div>
        </section>

        <!-- ACTIONS -->
        <div class="action-bar">
          @if (isHost) {
            <button class="btn btn-primary" [disabled]="!canStart" (click)="startGame()">
              Start Game
            </button>
            <button class="btn btn-danger-outline" (click)="cancelLobby()">
              Cancel Lobby
            </button>
          } @else {
            <button class="btn btn-danger-outline btn-full" (click)="leave()">
              Leave Lobby
            </button>
          }
        </div>
      </main>
    </div>
  `,
  styles: [`
    .lobby-page {
      max-width: 480px; margin: 0 auto; padding: 0 env(safe-area-inset-right) 24px env(safe-area-inset-left);
      min-height: 100dvh; min-height: 100vh; display: flex; flex-direction: column;
    }
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid #2a2a45;
    }
    .topbar-title { font-size: 18px; font-weight: 700; color: #e8e8f0; letter-spacing: 1px; }
    .topbar-back {
      padding: 10px 16px; border: 1px solid #2a2a45; border-radius: 8px;
      background: transparent; color: #9090b0; cursor: pointer; font-size: 14px; min-height: 44px;
    }
    .topbar-back:hover { color: #e8e8f0; border-color: #3a3a55; }

    .lobby-body { flex: 1; display: flex; flex-direction: column; gap: 16px; margin: 20px 16px 0; }

    .card {
      background: #141428; border: 1px solid #2a2a45; border-radius: 10px;
      padding: 20px; display: flex; flex-direction: column; gap: 12px;
    }
    .card h2 { margin: 0; font-size: 15px; font-weight: 600; color: #e8e8f0; }
    .card-sub { margin: 0; font-size: 12px; color: #7070a0; line-height: 1.4; }

    /* INVITE */
    .invite-card { flex-direction: row; align-items: flex-start; gap: 16px; }
    .card-icon {
      flex-shrink: 0; width: 40px; height: 40px; border-radius: 10px;
      background: linear-gradient(135deg, #6c5ce7, #a855f7); display: flex;
      align-items: center; justify-content: center; font-size: 18px;
    }
    .card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
    .invite-row { display: flex; gap: 8px; }
    .invite-input {
      flex: 1; min-width: 0; padding: 12px; border: 1px solid #2a2a45; border-radius: 8px;
      background: #0d0d1a; color: #c0c0d0; font-size: 14px; outline: none; min-height: 44px;
    }
    .invite-input:focus { border-color: #6c5ce7; }
    .btn-copy {
      flex-shrink: 0; padding: 12px 18px; border: none; border-radius: 8px;
      background: #6c5ce7; color: #fff; cursor: pointer; font-size: 14px; font-weight: 500;
      transition: background .15s; min-width: 72px; min-height: 44px;
    }
    .btn-copy:hover { background: #7c6cf7; }
    .btn-copy.copied { background: #22c55e; }

    /* PLAYERS */
    .card-header-row { display: flex; align-items: center; justify-content: space-between; }
    .player-count { font-size: 13px; color: #7070a0; font-weight: 500; }
    .player-list { display: flex; flex-direction: column; gap: 6px; }
    .player-row {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 12px; background: #0d0d1a; border-radius: 8px;
      border: 1px solid #1e1e35; transition: border-color .15s; min-height: 48px;
    }
    .player-row.is-host { border-color: #6c5ce7; }
    .player-avatar {
      width: 32px; height: 32px; border-radius: 8px; background: #1e1e35;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: #9090b0; flex-shrink: 0;
    }
    .player-avatar.host-avatar { background: #6c5ce7; color: #fff; }
    .player-name { flex: 1; font-size: 14px; color: #e8e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .host-badge {
      font-size: 10px; font-weight: 700; color: #6c5ce7; letter-spacing: 0.5px;
      background: rgba(108, 92, 231, 0.15); padding: 4px 8px; border-radius: 4px;
    }

    /* SETTINGS */
    .readonly-hint { font-size: 11px; color: #7070a0; background: #0d0d1a; padding: 4px 8px; border-radius: 4px; }
    .settings-grid { display: flex; flex-direction: column; gap: 14px; }
    .setting-field { display: flex; flex-direction: column; gap: 4px; }
    .setting-field label { font-size: 11px; font-weight: 600; color: #7070a0; text-transform: uppercase; letter-spacing: 0.5px; }
    .setting-field input, .setting-field select {
      padding: 12px; border: 1px solid #2a2a45; border-radius: 8px;
      background: #0d0d1a; color: #e8e8f0; font-size: 16px; outline: none; min-height: 48px;
    }
    .setting-field input:focus, .setting-field select:focus { border-color: #6c5ce7; }
    .setting-val { font-size: 14px; color: #c0c0d0; padding: 12px 0; }
    .setting-row { display: flex; align-items: center; gap: 8px; }
    .setting-row input { flex: 1; min-width: 0; text-align: center; }
    .setting-times { color: #7070a0; font-size: 16px; }

    /* ACTIONS */
    .action-bar {
      display: flex; gap: 10px; padding: 16px 0 0;
      border-top: 1px solid #2a2a45; margin: 4px 16px 0;
    }
    .btn {
      padding: 14px 24px; border: none; border-radius: 8px; cursor: pointer;
      font-size: 15px; font-weight: 600; transition: background .15s, opacity .15s;
      min-height: 48px;
    }
    .btn-primary {
      flex: 1; background: linear-gradient(135deg, #6c5ce7, #a855f7); color: #fff;
    }
    .btn-primary:disabled { opacity: .35; cursor: default; }
    .btn-primary:not(:disabled):hover { opacity: .9; }
    .btn-danger-outline {
      background: transparent; color: #ef4444; border: 1px solid #4a2020;
    }
    .btn-danger-outline:hover { background: rgba(239, 68, 68, 0.1); }
    .btn-full { flex: 1; }

    @media (max-width: 480px) {
      .lobby-page { padding: 0 0 16px; }
      .lobby-body { margin: 16px 12px 0; }
      .card { padding: 16px; }
      .invite-row { flex-direction: column; }
      .btn-copy { width: 100%; }
      .action-bar { margin: 4px 12px 0; }
      .action-bar { flex-direction: column; }
    }
  `]
})
export class LobbyComponent implements OnInit, OnDestroy {
  private subs: Subscription[] = [];
  private lobbyId = '';
  private userId = '';
  lobby: LobbyData | null = null;
  isHost = false;
  copied = false;

  get inviteUrl(): string {
    return `${environment.baseUrl}/lobby/${this.lobbyId}`;
  }

  get canStart(): boolean {
    return (this.lobby?.players?.length || 0) >= 2;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: GameApiService,
    private socket: SocketService,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.lobbyId = this.route.snapshot.paramMap.get('id')!;

    this.subs.push(
      this.authService.userData$().pipe(first()).subscribe(data => {
        this.userId = (data['preferred_username'] as string) || '';
        this.socket.connectLobby(this.userId);
        this.socket.joinLobbyRoom(this.lobbyId);
        this.loadLobby();
      }),

      this.socket.lobbyUpdate$.subscribe(data => {
        if (data.id === this.lobbyId) {
          this.lobby = data;
          this.isHost = data.hostId === this.userId;
        }
      }),

      this.socket.lobbyStarted$.subscribe(e => {
        this.socket.disconnectLobby();
        this.router.navigate(['/game', e.gameId]);
      }),

      this.socket.lobbyCancelled$.subscribe(e => {
        if (e.lobbyId === this.lobbyId) {
          this.socket.disconnectLobby();
          this.router.navigate(['/']);
        }
      }),
    );
  }

  private loadLobby() {
    this.api.getLobby(this.lobbyId).subscribe({
      next: (data) => {
        this.lobby = data;
        this.isHost = data.hostId === this.userId;
        if (!data.players.includes(this.userId)) {
          this.api.joinLobby(this.lobbyId).subscribe({
            next: () => this.loadLobby(),
            error: () => this.router.navigate(['/']),
          });
        }
      },
      error: () => this.router.navigate(['/']),
    });
  }

  selectInvite(event: Event) {
    (event.target as HTMLInputElement)?.select();
  }

  copyInvite() {
    navigator.clipboard.writeText(this.inviteUrl).then(() => {
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    });
  }

  updateSetting(key: string, value: unknown) {
    this.api.updateLobbySettings(this.lobbyId, { [key]: value }).subscribe();
  }

  startGame() {
    this.api.startLobbyGame(this.lobbyId).subscribe();
  }

  cancelLobby() {
    this.api.cancelLobby(this.lobbyId).subscribe(() => {
      this.socket.disconnectLobby();
      this.router.navigate(['/']);
    });
  }

  leave() {
    if (this.isHost) {
      this.cancelLobby();
      return;
    }
    this.api.leaveLobby(this.lobbyId).subscribe(() => {
      this.socket.disconnectLobby();
      this.router.navigate(['/']);
    });
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }
}
