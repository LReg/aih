import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-queue-status',
  standalone: true,
  template: `
    @if (queued) {
      <div class="queue-status">
        <div class="spinner"></div>
        <p>Searching for match...</p>
        @if (seconds > 0) {
          <p class="timer">Game starting in {{ seconds }}s</p>
        }
        <button class="leave-btn" (click)="leave.emit()">Leave Queue</button>
      </div>
    }
  `,
  styles: [`
    .queue-status {
      text-align: center;
      padding: 24px;
      background: var(--surface);
      border-radius: 12px;
      border: 1px solid var(--border);
    }
    .spinner {
      width: 32px; height: 32px;
      border: 3px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin .8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .timer { color: var(--primary); font-weight: 600; font-size: 18px; }
    .leave-btn {
      margin-top: 16px;
      padding: 8px 24px;
      border-radius: 8px;
      border: 1px solid var(--danger);
      background: transparent;
      color: var(--danger);
      cursor: pointer;
    }
    .leave-btn:hover { background: var(--danger); color: #fff; }
  `]
})
export class QueueStatusComponent {
  @Input() queued = false;
  @Input() seconds = 0;
  @Output() leave = new EventEmitter<void>();
}
