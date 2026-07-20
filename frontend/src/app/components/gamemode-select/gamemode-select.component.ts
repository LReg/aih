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
    <div class="gm-outer" [class.active]="state !== 'idle'">
      <div class="gm-glow"></div>
      <div class="gm-glow-color"></div>
      <div class="gm-inner" (click)="onClick()">
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
        @if (queueCount > 0 && state === 'idle') {
          <p class="queue-info">{{ queueCount }} in queue</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .gm-outer {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: transform .2s;
    }
    .gm-outer:not(.active):hover { transform: translateY(-2px); }
    .gm-outer.active { cursor: default; opacity: .75; }

    .gm-glow, .gm-glow-color {
      position: absolute;
      inset: 0;
      border-radius: 12px;
    }
    .gm-glow {
      background: conic-gradient(from 0deg, #334155, #475569, #334155, #1e293b, #334155);
    }
    .gm-glow-color {
      background: conic-gradient(from 0deg, #a78bfa, #60a5fa, #34d399, #a78bfa);
      opacity: 0;
      transition: opacity .35s .3s;
    }
    .gm-outer:not(.active):hover .gm-glow-color,
    .gm-outer.active .gm-glow-color {
      opacity: 1;
      animation: gmSpin 4s linear infinite;
    }
    .gm-outer.active .gm-glow-color {
      transition: opacity .35s;
    }
    @keyframes gmSpin { to { rotate: 360deg; } }

    .gm-inner {
      position: relative;
      margin: 2px;
      border-radius: 10px;
      background: var(--surface);
      padding: 24px;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    h3 { margin: 0; color: var(--text-primary); }
    p { margin: 0; color: var(--text-secondary); font-size: 14px; }
    .queue-info { margin-top: 4px; font-size: 12px; color: var(--accent); }
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
  @Input() queueCount = 0;
  @Output() select = new EventEmitter<string>();

  onClick() {
    if (this.state === 'idle') {
      this.select.emit(this.gamemode);
    }
  }
}
