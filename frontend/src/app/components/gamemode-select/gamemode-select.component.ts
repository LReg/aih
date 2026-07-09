import { Component, EventEmitter, Input, Output } from '@angular/core';

export type QueueState = 'idle' | 'queued' | 'countdown';

export interface GamemodeConfig {
  maxPlayers: number;
  mapWidth: number;
  mapHeight: number;
  tickRateMs: number;
}

@Component({
  selector: 'app-gamemode-select',
  standalone: true,
  template: `
    <div class="gamemode-card" [class.active]="state !== 'idle'" (click)="onClick()">
      <div class="card-header">
        <h3>{{ label }}</h3>
        <span class="badge" [class.queued]="state === 'queued'" [class.countdown]="state === 'countdown'">
          @switch (state) {
            @case ('idle') { Join }
            @case ('queued') { In Queue }
            @case ('countdown') { Match Starting... }
          }
        </span>
      </div>
      <p>{{ config.maxPlayers }} players, {{ config.mapWidth }}x{{ config.mapHeight }} map, {{ config.tickRateMs }}ms ticks</p>
    </div>
  `,
  styles: [`
    .gamemode-card {
      background: var(--surface);
      border: 2px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      cursor: pointer;
      transition: border-color .2s, transform .2s, opacity .2s;
    }
    .gamemode-card.active {
      border-color: var(--primary);
      cursor: default;
      opacity: .8;
    }
    .gamemode-card:not(.active):hover {
      border-color: var(--primary);
      transform: translateY(-2px);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    h3 { margin: 0; color: var(--text-primary); }
    p { margin: 0; color: var(--text-secondary); font-size: 14px; }
    .badge {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
    }
    .badge.queued { background: #2d2d5e; color: #7c7cf0; }
    .badge.countdown { background: #2d4a2d; color: #5ce75c; }
  `]
})
export class GamemodeSelectComponent {
  @Input() state: QueueState = 'idle';
  @Input() config: GamemodeConfig = { maxPlayers: 5, mapWidth: 100, mapHeight: 100, tickRateMs: 500 };
  @Input() label = 'Casual';
  @Input() gamemode = 'casual';
  @Output() select = new EventEmitter<string>();

  onClick() {
    if (this.state === 'idle') {
      this.select.emit(this.gamemode);
    }
  }
}
