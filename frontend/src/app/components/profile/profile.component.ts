import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AsyncPipe, NgIf, NgFor, DatePipe } from '@angular/common';
import { AuthService } from '../../service/auth/auth.service';
import { ProfileApiService, ProfileData } from '../../service/profile-api.service';
import { eloColor } from '../../util/elo';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [NgIf, AsyncPipe, NgFor, DatePipe, RouterLink],
  template: `
    <div class="profile-page">
      <div class="card">
        <div class="back-row">
          <a routerLink="/">&larr; Back</a>
        </div>

        <ng-container *ngIf="data; else loadingTpl">
          <div class="profile-head">
            <div class="avatar" [style.background]="data.elo !== null ? eloColor(data.elo) : '#555'">
              {{ data.username[0].toUpperCase() }}
            </div>
            <div class="info">
              <h2>{{ data.username }}</h2>
              <div class="elo-row" *ngIf="data.elo !== null">
                <span class="elo-badge" [style.background]="eloColor(data.elo)">{{ data.elo }}</span>
                <span class="stat">Wins: {{ data.wins }}</span>
                <span class="stat">Games: {{ data.gamesPlayed }}</span>
                <span class="stat" *ngIf="data.gamesPlayed > 0">Win%: {{ (data.wins / data.gamesPlayed * 100).toFixed(0) }}%</span>
              </div>
              <div class="elo-row" *ngIf="data.elo === null">
                <span class="stat">Guest — no rating</span>
              </div>
            </div>
          </div>

          <div class="match-history" *ngIf="data.matchHistory.length > 0">
            <h3>Match History</h3>
            <table>
              <thead>
                <tr><th>Gamemode</th><th>Place</th><th>Total</th><th>Elo &Delta;</th><th>Date</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let m of data.matchHistory" [class.win]="m.eloDelta > 0" [class.loss]="m.eloDelta < 0">
                  <td>{{ m.gamemode }}</td>
                  <td>{{ m.placement }}</td>
                  <td>{{ m.totalPlayers }}</td>
                  <td [style.color]="m.eloDelta > 0 ? '#22c55e' : m.eloDelta < 0 ? '#ef4444' : '#888'">
                    {{ m.eloDelta > 0 ? '+' : '' }}{{ m.eloDelta }}
                  </td>
                  <td>{{ m.timestamp | date:'short' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="no-history" *ngIf="data.matchHistory.length === 0">
            <p>No games played yet.</p>
          </div>
        </ng-container>

        <ng-template #loadingTpl>
          <p class="loading">Loading...</p>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .profile-page { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .card { background: var(--surface, #1a1a2e); border: 1px solid var(--border, #333); border-radius: 12px; padding: 24px; }
    .back-row { margin-bottom: 16px; }
    .back-row a { color: var(--accent, #3b82f6); text-decoration: none; font-size: 14px; }
    .profile-head { display: flex; gap: 16px; align-items: center; margin-bottom: 24px; }
    .avatar { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: #fff; flex-shrink: 0; }
    .info h2 { margin: 0 0 8px; font-size: 20px; color: var(--text-primary, #eee); }
    .elo-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .elo-badge { padding: 3px 10px; border-radius: 12px; color: #fff; font-weight: 700; font-size: 15px; }
    .stat { color: var(--text-secondary, #999); font-size: 13px; }
    h3 { margin: 0 0 12px; font-size: 16px; color: var(--text-primary, #eee); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border, #333); color: var(--text-secondary, #999); }
    td { padding: 6px 8px; border-bottom: 1px solid var(--border, #333); color: var(--text-primary, #eee); }
    .win { background: rgba(34,197,94,0.06); }
    .loss { background: rgba(239,68,68,0.06); }
    .no-history p, .loading { color: var(--text-secondary, #999); text-align: center; padding: 24px 0; }
  `]
})
export class ProfileComponent implements OnInit {
  data: ProfileData | null = null;
  eloColor = eloColor;

  constructor(
    private api: ProfileApiService,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.api.getMyProfile().subscribe({
      next: d => this.data = d,
      error: () => this.router.navigate(['/login']),
    });
  }
}
