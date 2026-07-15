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
  playerNames?: Record<string, string>;
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
        <span class="topbar-title">
          <svg class="topbar-logo" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
          Admin
        </span>
        <div class="topbar-actions">
          <button class="icon-btn" (click)="refresh()" [disabled]="refreshing" aria-label="Refresh stats">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [class.spinning]="refreshing"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v5h-5"/></svg>
          </button>
          <button class="text-btn" (click)="goHome()" aria-label="Go home">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Home
          </button>
        </div>
      </header>

      @if (!authenticated) {
        <main class="login-card">
          <svg class="login-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3 11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <h2 class="login-heading">Admin Access</h2>
          <input
            class="text-input"
            type="password"
            placeholder="Enter admin password"
            [(ngModel)]="password"
            (keydown.enter)="login()"
            autofocus
            aria-label="Admin password"
          />
          @if (loginError) {
            <p class="error-msg" role="alert">{{ loginError }}</p>
          }
          <button class="btn btn-primary" (click)="login()" [disabled]="!password">Unlock</button>
        </main>
      } @else if (loading) {
        <main class="loading-state">
          <div class="skeleton-group">
            <div class="skeleton skeleton-card"></div>
            <div class="skeleton skeleton-card"></div>
            <div class="skeleton skeleton-card"></div>
            <div class="skeleton skeleton-card"></div>
          </div>
          <div class="skeleton skeleton-section"></div>
          <div class="skeleton skeleton-section"></div>
        </main>
      } @else if (stats) {
        <main class="dashboard">
          <div class="stats-grid">
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

          <section class="card">
            <h3 class="card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Game Health
            </h3>
            @if (gameHealthRows.length > 0) {
              <div class="table-scroll">
                <table class="table">
                  <thead><tr><th>Game</th><th>Ticks</th><th>Util</th><th>Status</th></tr></thead>
                  <tbody>
                    @for (entry of gameHealthRows; track entry.id) {
                      <tr>
                        <td class="mono">{{ shortId(entry.id) }}&hellip;</td>
                        <td class="mono">{{ entry.stats.count }}</td>
                        <td class="mono" [ngClass]="utilClass(entry.stats.avgUtil)">
                          {{ entry.stats.avgUtil }}%
                          <span class="hint">({{ entry.stats.avg }}ms / {{ entry.stats.tickRateMs }}ms)</span>
                        </td>
                        <td>
                          <span class="pill" [ngClass]="entry.stats.avgUtil > 100 ? 'pill-warn' : 'pill-ok'">{{ entry.stats.avgUtil > 100 ? 'LAGGING' : 'OK' }}</span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="empty">No tick data yet</p>
            }
          </section>

          <section class="card">
            <h3 class="card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Tick Diff
            </h3>
            @if (stats.tickDiff.overall) {
              <div class="diff-section">
                <div class="diff-bar">
                  <div class="diff-bar-label">Avg utilization <strong class="mono" [ngClass]="utilClass(stats.tickDiff.overall.avgUtil)">{{ stats.tickDiff.overall.avgUtil }}%</strong></div>
                  <div class="diff-track">
                    <div class="diff-fill" [style.width.%]="utilBarPct()" [ngClass]="stats.tickDiff.overall.avgUtil > 100 ? 'fill-warn' : 'fill-ok'"></div>
                  </div>
                </div>
                <div class="diff-meta">
                  <span class="mono">{{ stats.tickDiff.overall.avg }}ms</span>
                  <span class="dim">avg</span>
                  <span class="sep">&middot;</span>
                  <span class="mono">{{ stats.tickDiff.overall.count }}</span>
                  <span class="dim">samples</span>
                </div>
              </div>
            } @else {
              <p class="empty">No tick data yet</p>
            }
          </section>

          <section class="card">
            <h3 class="card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Finished Games
            </h3>
            @if (finishedGameRows.length > 0) {
              <div class="table-scroll">
                <table class="table">
                  <thead><tr><th>Game</th><th>Mode</th><th>Players</th><th>Winner</th><th>Ticks</th><th>Rate</th></tr></thead>
                  <tbody>
                    @for (g of finishedGameRows; track g.gameId) {
                      <tr>
                        <td class="mono">{{ shortId(g.gameId) }}&hellip;</td>
                        <td class="capitalize">{{ g.gamemode }}</td>
                        <td class="truncate">{{ resolveNames(g.players, g.playerNames) }}</td>
                        <td>
                          @if (g.winners && g.winners.length > 0) {
                            <span class="winner">{{ resolveNames(g.winners, g.playerNames ?? {}) }}</span>
                          } @else {
                            <span class="dim">&mdash;</span>
                          }
                        </td>
                        <td class="mono">{{ g.finalTick ?? '&mdash;' }}</td>
                        <td class="mono">{{ g.tickRateMs }}ms</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="empty">No finished games</p>
            }
          </section>

          <div class="split-row">
            <section class="card">
              <h3 class="card-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3 3" width="7" height="7"/><rect x="14 3" width="7" height="7"/><rect x="14 14" width="7" height="7"/><rect x="3 14" width="7" height="7"/></svg>
                Queues
              </h3>
              @if (queueEntries.length > 0) {
                <div class="list">
                  @for (q of queueEntries; track q.name) {
                    <div class="list-row">
                      <span class="list-label capitalize">{{ q.name }}</span>
                      <span class="list-value mono">{{ q.count }}</span>
                    </div>
                  }
                </div>
              } @else {
                <p class="empty">No active queues</p>
              }
            </section>

            <section class="card">
              <h3 class="card-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>
                Lobbies
              </h3>
              <div class="list">
                <div class="list-row">
                  <span class="list-label">Active</span>
                  <span class="list-value mono">{{ stats.lobbies.active }}</span>
                </div>
                <div class="list-row">
                  <span class="list-label">Total created</span>
                  <span class="list-value mono">{{ stats.lobbies.totalCreated }}</span>
                </div>
              </div>
            </section>
          </div>
        </main>
      }
    </div>
  `,
  styles: [`
    :host {
      --bg: #0b0d14;
      --surface: #12141e;
      --card-bg: #181b28;
      --border: #232638;
      --border-hover: #2e3145;
      --text: #e4e6f0;
      --text-secondary: #9298b0;
      --text-dim: #5d6380;
      --accent: #5b8def;
      --accent-hover: #7ba3f5;
      --accent-muted: rgba(91,141,239,.12);
      --danger: #ef4444;
      --warn: #f59e0b;
      --ok: #22c55e;
      --radius: 10px;
      --radius-sm: 6px;
    }

    .admin-page {
      max-width: 960px;
      margin: 0 auto;
      padding: 0 24px;
      min-height: 100dvh;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 0;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }
    .topbar-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 600;
      color: var(--text);
    }
    .topbar-logo { color: var(--accent); }
    .topbar-actions { display: flex; align-items: center; gap: 8px; }

    .icon-btn {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      transition: .15s;
    }
    .icon-btn:hover { color: var(--text); border-color: var(--border-hover); background: var(--accent-muted); }
    .icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .icon-btn:disabled { opacity: .35; pointer-events: none; }
    .spinning { animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .text-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: .15s;
    }
    .text-btn:hover { color: var(--text); border-color: var(--border-hover); background: var(--accent-muted); }
    .text-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    .login-card {
      max-width: 360px;
      margin: 100px auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding: 48px 32px;
      background: var(--card-bg);
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }
    .login-icon { color: var(--accent); }
    .login-heading { margin: 0; font-size: 18px; font-weight: 600; }

    .text-input {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font-size: 15px;
      outline: none;
      transition: .15s;
      box-sizing: border-box;
    }
    .text-input::placeholder { color: var(--text-dim); }
    .text-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-muted); }
    .text-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

    .btn {
      width: 100%;
      padding: 12px 20px;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: .15s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .btn:disabled { opacity: .4; cursor: default; }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:not(:disabled):hover { background: var(--accent-hover); }

    .error-msg { color: var(--danger); font-size: 13px; margin: 0; text-align: center; }

    .loading-state { padding: 48px 0; display: flex; flex-direction: column; gap: 16px; }
    .skeleton-group { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
    .skeleton {
      background: linear-gradient(110deg, var(--card-bg) 30%, var(--surface) 50%, var(--card-bg) 70%);
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
      border-radius: var(--radius);
    }
    .skeleton-card { height: 88px; }
    .skeleton-section { height: 120px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .dashboard { padding-bottom: 48px; display: flex; flex-direction: column; gap: 16px; }

    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }

    .stat-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 20px;
      background: var(--card-bg);
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }
    .stat-card.accent { border-color: var(--accent); }
    .stat-value { font-size: 28px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
    .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-secondary); font-weight: 600; }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
    }
    .card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: var(--text-secondary);
      font-weight: 600;
    }
    .card-title svg { color: var(--accent); flex-shrink: 0; }

    .split-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 640px) { .split-row { grid-template-columns: 1fr; } }

    .table-scroll { overflow-x: auto; margin: -4px 0; }

    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .table th {
      text-align: left;
      padding: 8px 12px;
      color: var(--text-dim);
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .06em;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .table td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .table tr:last-child td { border-bottom: none; }
    .table tbody tr { transition: background .1s; }
    .table tbody tr:hover td { background: rgba(255,255,255,.025); }
    .table thead { position: sticky; top: 0; z-index: 1; }

    .mono { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 12px; }
    .hint { font-size: 10px; color: var(--text-dim); margin-left: 4px; }
    .dim { color: var(--text-dim); }
    .sep { color: var(--border); margin: 0 4px; }
    .truncate { max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
    .capitalize { text-transform: capitalize; }
    .empty { color: var(--text-dim); font-size: 13px; margin: 8px 0; }

    .winner { color: var(--ok); font-weight: 600; }

    .pill {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: .04em;
    }
    .pill-ok { background: rgba(34,197,94,.12); color: var(--ok); }
    .pill-warn { background: rgba(245,158,11,.12); color: var(--warn); }

    .diff-section { display: flex; flex-direction: column; gap: 12px; }
    .diff-bar { display: flex; flex-direction: column; gap: 6px; }
    .diff-bar-label { font-size: 13px; color: var(--text-secondary); }
    .diff-track { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .diff-fill { height: 100%; border-radius: 3px; transition: width .4s ease; }
    .fill-ok { background: var(--ok); }
    .fill-warn { background: var(--warn); }
    .diff-meta { display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--text-secondary); }

    .list { display: flex; flex-direction: column; }
    .list-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    .list-row:last-child { border-bottom: none; }
    .list-label { font-size: 14px; }
    .list-value { font-size: 16px; font-weight: 700; }

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

  resolveNames(ids?: string[], names?: Record<string, string>): string {
    if (!ids || ids.length === 0) return '\u2014';
    return ids.map(id => (names && names[id]) || id).join(', ');
  }

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
