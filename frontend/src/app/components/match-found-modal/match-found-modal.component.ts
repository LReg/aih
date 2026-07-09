import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-match-found-modal',
  standalone: true,
  template: `
    @if (show) {
      <div class="overlay" (click)="dismiss.emit()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Match Found!</h2>
          <p>Players: {{ players.join(', ') }}</p>
          <button class="play-btn" (click)="navigate.emit()">Enter Game</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.6);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
    }
    .modal {
      background: var(--surface);
      border-radius: 16px;
      padding: 32px;
      text-align: center;
      min-width: 300px;
    }
    h2 { margin: 0 0 12px; color: var(--primary); }
    p { color: var(--text-secondary); margin: 0 0 24px; }
    .play-btn {
      padding: 12px 32px;
      border: none;
      border-radius: 8px;
      background: var(--primary);
      color: #fff;
      font-size: 16px;
      cursor: pointer;
    }
    .play-btn:hover { opacity: .9; }
  `]
})
export class MatchFoundModalComponent {
  @Input() show = false;
  @Input() players: string[] = [];
  @Output() navigate = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();
}
