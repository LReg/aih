import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { interval, Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';

interface TickStats {
  avg: number; min: number; max: number; count: number;
  avgUtil: number; minUtil: number; maxUtil: number; tickRateMs: number;
}

interface GameDetail {
  gameId: string;
  gamemode: string;
  startedAt: string;
  endedAt: string | null;
  finalTick: number | null;
  players: string[];
  winners: string[];
  tickRateMs: number;
}

interface AdminStats {
  games: {
    totalCreated: number; running: number; finished: number;
    details: GameDetail[];
  };
  lobbies: { active: number; totalCreated: number };
  queues: Record<string, number>;
  tickDiff: {
    byGame: Record<string, TickStats>;
    overall: TickStats | null;
  };
  health: {
    lagging: string[];
    healthy: string[];
    totalWithTickData: number;
  };
}

@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [NgClass, FormsModule],
  template: `
    <div class="admin-page">
      <header class="topbar">
        <span class="topbar-title">Strat Admin</span>
        <div class="topbar-actions">
          <button class="topbar-btn" (click)="refresh()" [disabled]="refreshing">&#x21bb;</button>
          <button class="topbar-back" (click)="goHome()">&larr; Home</button>
        </div>
      </header>

      @if (!authenticated) {
        <main class="login-card">
          <div class="lock-icon">&#128274;</div>
          <h2>Admin Access</h2>
          <input
            class="pwd-input"
            type="password"
            placeholder="Enter password"
            [(ngModel)]="password"
            (keydown.enter)="login()"
            autofocus
          />
          @if (loginError) {
            <p class="error-msg">{{ loginError }}</p>
          }
          <button class="login-btn" (click)="login()" [disabled]="!password">Unlock</button>
        </main>
      } @else if (loading) {
        <main class="loading-state">
          <div class="spinner"></div>
          <p>Loading stats...</p>
        </main>
      } @else if (stats) {
        <main class="dashboard">
          <div class="summary-row">
            <div class="stat-card">
              <span class="stat-value">{{ stats.games.totalCreated }}</span>
              <span class="stat-label">Games Created</span>
            </div>
            <div class="stat-card accent">
              <span class="stat-value">{{ stats.games.running }}</span>
              <span class="stat-label">Running Now</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">{{ stats.games.finished }}</span>
              <span class="stat-label">Finished</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">{{ stats.lobbies.active }}</span>
              <span class="stat-label">Active Lobbies</span>
            </div>
          </div>

          <section class="section">
            <h3 class="section-title">Game Health</h3>
            @if (gameHealthRows.length > 0) {
              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Game ID</th>
                      <th>Ticks</th>
                      <th>Util</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (entry of gameHealthRows; track entry.id) {
                      <tr>
                        <td class="mono">{{ shortId(entry.id) }}...</td>
                        <td class="mono">{{ entry.stats.count }}</td>
                        <td class="mono" [ngClass]="utilClass(entry.stats.avgUtil)">
                          {{ entry.stats.avgUtil }}%
                          <span class="raw-hint">({{ entry.stats.avg }}ms / {{ entry.stats.tickRateMs }}ms tick)</span>
                        </td>
                        <td>
                          <span class="badge" [ngClass]="entry.stats.avgUtil > 100 ? 'badge-warn' : 'badge-ok'">
                            {{ entry.stats.avgUtil > 100 ? 'LAGGING' : 'OK' }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="dim">No tick data yet</p>
            }
          </section>

          <section class="section">
            <h3 class="section-title">Tick Diff Summary</h3>
            @if (stats.tickDiff.overall) {
              <div class="diff-summary">
                <div class="diff-bar-wrap">
                  <div class="diff-bar-label">Avg tick util: <strong class="mono" [ngClass]="utilClass(stats.tickDiff.overall.avgUtil)">{{ stats.tickDiff.overall.avgUtil }}%</strong></div>
                  <div class="diff-track">
                    <div class="diff-fill" [style.width.%]="utilBarPct()" [ngClass]="stats.tickDiff.overall.avgUtil > 100 ? 'fill-warn' : 'fill-ok'"></div>
                  </div>
                </div>
                <div class="diff-range">
                  <span class="mono">{{ stats.tickDiff.overall.avg }}ms</span>
                  <span class="dim">avg</span>
                  <span class="sep">|</span>
                  <span class="mono">{{ stats.tickDiff.overall.count }}</span>
                  <span class="dim">samples</span>
                </div>
              </div>
            } @else {
              <p class="dim">No tick data yet</p>
            }
          </section>

          <section class="section">
            <h3 class="section-title">Finished Games</h3>
            @if (finishedGameRows.length > 0) {
              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Game</th>
                      <th>Mode</th>
                      <th>Players</th>
                      <th>Winner</th>
                      <th>Ticks</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (g of finishedGameRows; track g.gameId) {
                      <tr>
                        <td class="mono">{{ shortId(g.gameId) }}...</td>
                        <td>{{ g.gamemode }}</td>
                        <td class="players-cell">{{ g.players.join(', ') }}</td>
                        <td>
                          @if (g.winners.length > 0) {
                            <span class="winner-text">{{ g.winners.join(', ') }}</span>
                          } @else {
                            <span class="dim">—</span>
                          }
                        </td>
                        <td class="mono">{{ g.finalTick ?? '—' }}</td>
                        <td class="mono">{{ g.tickRateMs }}ms</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="dim">No finished games yet</p>
            }
          </section>

          <div class="split-row">
            <section class="section">
              <h3 class="section-title">Queues</h3>
              @if (queueEntries.length > 0) {
                <div class="queue-list">
                  @for (q of queueEntries; track q.name) {
                    <div class="queue-row">
                      <span class="queue-name">{{ q.name }}</span>
                      <span class="queue-count mono">{{ q.count }}</span>
                    </div>
                  }
                </div>
              } @else {
                <p class="dim">No active queues</p>
              }
            </section>

            <section class="section">
              <h3 class="section-title">Lobbies</h3>
              <div class="lobby-stats">
                <div class="lobby-row">
                  <span>Active</span>
                  <span class="mono">{{ stats.lobbies.active }}</span>
                </div>
                <div class="lobby-row">
                  <span>Total created</span>
                  <span class="mono">{{ stats.lobbies.totalCreated }}</span>
                </div>
              </div>
            </section>
          </div>
        </main>
      }
    </div>
  `,
  styles: [`
    :host { --bg: #0f1117; --card: #1a1d28; --border: #2a2d3a; --text: #e1e4ed; --dim: #7a7f8e; --accent: #5b8def; --danger: #ef4444; --warn: #f59e0b; --ok: #22c55e; }
    .admin-page { max-width: 900px; margin: 0 auto; padding: 0 16px; min-height: 100dvh; background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, sans-serif; }
    .topbar { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid var(--border); margin-bottom: 24px; }
    .topbar-title { font-size: 20px; font-weight: 700; }
    .topbar-actions { display: flex; align-items: center; gap: 8px; }
    .topbar-back { padding: 10px 16px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--dim); cursor: pointer; font-size: 14px; transition: .15s; }
    .topbar-back:hover { color: var(--text); border-color: var(--accent); }
    .topbar-btn { width: 38px; height: 38px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--dim); cursor: pointer; font-size: 18px; line-height: 1; transition: .15s; display: flex; align-items: center; justify-content: center; }
    .topbar-btn:hover { color: var(--accent); border-color: var(--accent); }
    .topbar-btn:disabled { opacity: .3; }

    .login-card { max-width: 340px; margin: 80px auto; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 40px 24px; background: var(--card); border-radius: 12px; border: 1px solid var(--border); }
    .lock-icon { font-size: 36px; margin-bottom: 4px; }
    .login-card h2 { margin: 0; font-size: 20px; font-weight: 600; }
    .pwd-input { width: 100%; padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); font-size: 15px; outline: none; transition: .15s; box-sizing: border-box; }
    .pwd-input:focus { border-color: var(--accent); }
    .login-btn { width: 100%; padding: 12px; border: none; border-radius: 8px; background: var(--accent); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity .15s; }
    .login-btn:disabled { opacity: .4; cursor: default; }
    .login-btn:not(:disabled):hover { opacity: .85; }
    .error-msg { color: var(--danger); font-size: 13px; margin: 0; }

    .loading-state { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 80px 0; }
    .spinner { width: 32px; height: 32px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-state p { color: var(--dim); margin: 0; }

    .dashboard { padding-bottom: 48px; }
    .summary-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card { display: flex; flex-direction: column; gap: 4px; padding: 20px 16px; background: var(--card); border-radius: 10px; border: 1px solid var(--border); }
    .stat-card.accent { border-color: var(--accent); }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--dim); }
    .section { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
    .section-title { margin: 0 0 16px; font-size: 14px; text-transform: uppercase; letter-spacing: .06em; color: var(--dim); font-weight: 600; }
    .split-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    @media (max-width: 600px) { .split-row { grid-template-columns: 1fr; } }

    .table-wrap { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table th { text-align: left; padding: 8px 12px; color: var(--dim); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid var(--border); white-space: nowrap; }
    .data-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tr:hover td { background: rgba(255,255,255,.03); }
    .mono { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 12px; }
    .raw-hint { font-size: 10px; color: var(--dim); margin-left: 4px; }
    .players-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
    .winner-text { color: var(--ok); font-weight: 600; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; letter-spacing: .04em; }
    .badge-ok { background: rgba(34,197,94,.15); color: var(--ok); }
    .badge-warn { background: rgba(245,158,11,.15); color: var(--warn); }

    .diff-summary { display: flex; flex-direction: column; gap: 10px; }
    .diff-bar-wrap { display: flex; flex-direction: column; gap: 6px; }
    .diff-bar-label { font-size: 13px; }
    .diff-track { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; width: 100%; }
    .diff-fill { height: 100%; border-radius: 4px; transition: width .3s; }
    .fill-ok { background: var(--ok); }
    .fill-warn { background: var(--warn); }
    .diff-range { display: flex; gap: 6px; align-items: center; font-size: 13px; }
    .dim { color: var(--dim); }
    .sep { color: var(--border); }

    .queue-list { display: flex; flex-direction: column; gap: 8px; }
    .queue-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
    .queue-row:last-child { border-bottom: none; }
    .queue-name { font-size: 14px; text-transform: capitalize; }
    .queue-count { font-size: 18px; font-weight: 700; }

    .lobby-stats { display: flex; flex-direction: column; gap: 8px; }
    .lobby-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
    .lobby-row:last-child { border-bottom: none; }

    .tick-ok { color: var(--ok); }
    .tick-warn { color: var(--warn); }
    .tick-danger { color: var(--danger); }
  `],
})
export class AdminStatsComponent implements OnDestroy {
  password = '';
  authenticated = false;
  loginError = '';
  loading = false;
  refreshing = false;
  stats: AdminStats | null = null;
  private refreshSub?: Subscription;

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  get gameHealthRows(): { id: string; stats: TickStats }[] {
    if (!this.stats) return [];
    const byGame = this.stats.tickDiff.byGame;
    return Object.keys(byGame)
      .map(id => ({ id, stats: byGame[id] }))
      .sort((a, b) => b.stats.count - a.stats.count);
  }

  get finishedGameRows(): GameDetail[] {
    if (!this.stats) return [];
    return this.stats.games.details
      .filter(g => g.endedAt)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  get queueEntries(): { name: string; count: number }[] {
    if (!this.stats) return [];
    return Object.entries(this.stats.queues)
      .filter(([, c]) => c > 0)
      .map(([name, count]) => ({ name, count }));
  }

  shortId(id: string): string { return id.slice(0, 8); }

  utilClass(util: number): string {
    if (util <= 80) return 'tick-ok';
    if (util <= 100) return 'tick-warn';
    return 'tick-danger';
  }

  utilBarPct(): number {
    if (!this.stats?.tickDiff.overall) return 10;
    return Math.max(2, Math.min(100, this.stats.tickDiff.overall.avgUtil));
  }

  login() {
    if (!this.password) return;
    this.loginError = '';
    this.loading = true;
    this.fetchStats();
  }

  private fetchStats() {
    const params = new HttpParams().set('password', this.password);
    this.http.get<AdminStats>(`${environment.apiUrl}/admin/stats`, { params }).subscribe({
      next: (data) => {
        this.authenticated = true;
        this.loading = false;
        this.stats = data;
        this.startAutoRefresh();
      },
      error: () => {
        this.loading = false;
        this.loginError = 'Invalid password';
        this.password = '';
      },
    });
  }

  private startAutoRefresh() {
    this.refreshSub = interval(5000).subscribe(() => {
      const params = new HttpParams().set('password', this.password);
      this.http.get<AdminStats>(`${environment.apiUrl}/admin/stats`, { params }).subscribe({
        next: (data) => { this.stats = data; },
        error: () => { this.stopAutoRefresh(); },
      });
    });
  }

  private stopAutoRefresh() {
    this.refreshSub?.unsubscribe();
    this.refreshSub = undefined;
  }

  refresh() {
    if (this.refreshing) return;
    this.refreshing = true;
    const params = new HttpParams().set('password', this.password);
    this.http.get<AdminStats>(`${environment.apiUrl}/admin/stats`, { params }).subscribe({
      next: (data) => { this.stats = data; this.refreshing = false; },
      error: () => { this.refreshing = false; },
    });
  }

  goHome() {
    this.stopAutoRefresh();
    this.router.navigate(['/']);
  }

  ngOnDestroy() {
    this.stopAutoRefresh();
  }
}
