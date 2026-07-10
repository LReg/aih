import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { first, Subscription } from 'rxjs';
import Phaser from 'phaser';
import { GameApiService } from '../../service/game-api.service';
import { SocketService } from '../../service/socket.service';
import { AuthService } from '../../service/auth/auth.service';
import { GameState, Entity } from '../../types/game.types';
import { BootScene } from './scenes/boot-scene';
import { GameScene } from './scenes/game-scene';

@Component({
  selector: 'app-game',
  standalone: true,
  template: `
    <div class="game-layout">
      <div class="top-bar">
        <div class="top-left">
          <span class="game-timer">{{ elapsedTime }}</span>
          @if (peaceRemaining > 0) {
            <span class="peace-badge">Peace {{ peaceRemaining }}s</span>
          }
        </div>
        <span class="player-label" [style.color]="playerColor">{{ playerName }}</span>
        <div class="top-right">
          <span class="game-tick">Tick {{ gameTick }}</span>
          @if (!gameFinished) {
            <button class="btn-surrender" (click)="showSurrenderModal = true">Give Up</button>
          }
        </div>
      </div>
      <div #phaserContainer class="phaser-container"></div>

      @if (showSurrenderModal) {
        <div class="modal-overlay" (click)="showSurrenderModal = false">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>Give Up?</h2>
            <p>All your units will be removed and you will leave the game.</p>
            <div class="modal-actions">
              <button class="mbtn cancel" (click)="showSurrenderModal = false">Cancel</button>
              <button class="mbtn confirm" (click)="surrender()">Give Up</button>
            </div>
          </div>
        </div>
      }

      @if (gameFinished) {
        <div class="game-over">
          <h2>Game Over</h2>
          <p [class.winner]="isWinner" [class.loser]="!isWinner">
            {{ isWinner ? 'You won!' : 'You lost' }}
          </p>
          <p class="winners-list">Winners: {{ winners.join(', ') }}</p>
          <button class="btn-leave" (click)="leaveGame()">Leave Game</button>
        </div>
      }

      @if (selectedEntities.length > 0 || targetingMode) {
        <div class="cmd-bar">
          <div class="cmd-left">
            <span class="sel-count">{{ selectedEntities.length }}</span>
            @if (selectedSoldiers > 0) {
              <span class="sel-type">{{ selectedSoldiers }} <span class="dim">soldier</span></span>
            }
            @if (selectedBarracks > 0) {
              <span class="sel-type">{{ selectedBarracks }} <span class="dim">barracks</span></span>
            }
            @if (hasBusy) {
              <span class="sel-type busy">Occupied</span>
            }
          </div>
          <div class="cmd-buttons">
            @if (targetingMode) {
              <span class="target-hint">
                {{ targetingMode === 'walk' ? 'Select destination' : 'Select target' }}
              </span>
              <button class="cbtn cancel" (click)="cancelTargeting()">&times; Cancel</button>
            } @else {
              <button class="cbtn" (click)="startWalk()">
                <span class="keyhint">Q</span>
                Move
              </button>
              <button class="cbtn" (click)="startAttack()">
                <span class="keyhint">W</span>
                Attack
              </button>
              <button class="cbtn" (click)="buildBarracks()">
                <span class="keyhint">E</span>
                Build
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .game-layout {
      width: 100vw; height: 100dvh; height: 100vh;
      display: flex; flex-direction: column;
      background: #1a1a2e; overflow: hidden;
    }
    .top-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 16px;
      background: #0d0d1a;
      border-bottom: 1px solid #2a2a45;
      min-height: 48px; gap: 8px;
    }
    .top-left, .top-right {
      display: flex; align-items: center; gap: 8px;
    }
    .game-timer {
      font-size: 15px; font-weight: 600;
      color: #e8e8f0; font-variant-numeric: tabular-nums;
    }
    .game-tick { font-size: 12px; color: #7070a0; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .player-label {
      font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      letter-spacing: 0.3px; text-shadow: 0 0 6px currentColor;
    }
    .peace-badge {
      font-size: 11px; font-weight: 600;
      color: #5ce75c; background: #1a3a1a;
      border: 1px solid #2a5a2a;
      border-radius: 4px; padding: 3px 6px;
      font-variant-numeric: tabular-nums; white-space: nowrap;
    }
    .phaser-container { flex: 1; min-height: 0; }

    .cmd-bar {
      display: flex; align-items: center;
      justify-content: space-between;
      padding: 8px env(safe-area-inset-right) 8px env(safe-area-inset-left);
      background: linear-gradient(180deg, #0d0d1a 0%, #141428 100%);
      border-top: 1px solid #2a2a45;
      box-shadow: 0 -2px 8px rgba(0,0,0,.4);
      min-height: 52px; gap: 8px;
    }
    .cmd-left { display: flex; align-items: center; gap: 6px; min-width: 0; flex-shrink: 1; overflow: hidden; }
    .sel-count {
      font-size: 18px; font-weight: 700;
      color: #e8e8f0; min-width: 24px; text-align: center;
    }
    .sel-type { font-size: 12px; color: #e8e8f0; white-space: nowrap; }
    .sel-type .dim { color: #7070a0; font-weight: 400; }
    .sel-type.busy { color: #ff8800; font-weight: 600; }

    .cmd-buttons { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

    .cbtn {
      position: relative;
      display: flex; flex-direction: column; align-items: center;
      padding: 8px 14px 6px;
      border: 1px solid #2a2a45;
      border-radius: 6px;
      background: #1a1a2e;
      color: #c0c0d0;
      font-size: 13px; font-weight: 500;
      cursor: pointer;
      min-width: 56px; min-height: 44px;
      transition: background .1s, border-color .1s, color .1s;
    }
    .cbtn:hover:not(.disabled) { background: #2a2a45; border-color: #6c5ce7; color: #e8e8f0; }
    .cbtn.disabled { opacity: .3; cursor: default; }
    .cbtn.cancel { flex-direction: row; gap: 4px; color: #e74c3c; border-color: #4a2020; }
    .cbtn.cancel:hover { background: #2a1515; }

    .keyhint {
      position: absolute; top: -5px; right: -5px;
      font-size: 9px; font-weight: 700;
      background: #2a2a45; color: #6c5ce7;
      border: 1px solid #3a3a55;
      border-radius: 3px;
      padding: 1px 5px; line-height: 14px;
      min-width: 16px; text-align: center;
    }

    .target-hint {
      font-size: 12px; color: #ffcc00; font-weight: 500;
      margin-right: 4px; white-space: nowrap;
    }

    .btn-surrender {
      padding: 10px 14px; border: 1px solid #4a2020; border-radius: 6px;
      background: transparent; color: #ef4444; cursor: pointer;
      font-size: 12px; font-weight: 600;
      transition: background .15s; min-height: 44px; white-space: nowrap;
    }
    .btn-surrender:hover { background: rgba(239, 68, 68, 0.12); }

    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.7);
      display: flex; align-items: center; justify-content: center;
      z-index: 3000; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    }
    .modal {
      background: #1a1a2e; border: 1px solid #2a2a45; border-radius: 12px;
      padding: 24px; max-width: 340px; width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,.5);
    }
    .modal h2 { margin: 0 0 8px; font-size: 18px; color: #e8e8f0; }
    .modal p { margin: 0 0 20px; font-size: 14px; color: #9090b0; line-height: 1.5; }
    .modal-actions { display: flex; gap: 10px; }
    .mbtn {
      flex: 1; padding: 12px; border-radius: 8px; cursor: pointer;
      font-size: 15px; font-weight: 600; border: none; min-height: 48px;
    }
    .mbtn.cancel { background: #2a2a45; color: #c0c0d0; }
    .mbtn.cancel:hover { background: #3a3a55; }
    .mbtn.confirm { background: #ef4444; color: #fff; }
    .mbtn.confirm:hover { opacity: .85; }

    .game-over {
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,.75);
      z-index: 2000;
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    }
    .game-over h2 { font-size: 32px; margin: 0 0 12px; color: #e8e8f0; }
    .game-over p { margin: 0 0 8px; font-size: 18px; }
    .winner { color: #5ce75c; font-weight: 700; }
    .loser { color: #ff4444; font-weight: 700; }
    .winners-list { color: #9090b0; font-size: 14px !important; }
    .btn-leave {
      margin-top: 16px; padding: 12px 32px;
      border: 1px solid #e74c3c; border-radius: 8px;
      background: transparent; color: #e74c3c;
      cursor: pointer; font-size: 15px; min-height: 48px;
    }
    .btn-leave:hover { background: #2a1515; }

    @media (max-width: 480px) {
      .top-bar { padding: 6px 10px; min-height: 44px; gap: 4px; }
      .game-timer { font-size: 13px; }
      .game-tick { display: none; }
      .player-label { font-size: 12px; }
      .peace-badge { font-size: 10px; padding: 2px 5px; }
      .cmd-bar { padding: 6px 10px; min-height: 48px; }
      .cbtn { min-width: 48px; padding: 8px 10px 6px; font-size: 12px; }
      .sel-count { font-size: 16px; min-width: 20px; }
      .sel-type { font-size: 11px; }
      .target-hint { font-size: 11px; }
      .btn-surrender { padding: 8px 10px; font-size: 11px; }
    }
  `]
})
export class GameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('phaserContainer') container!: ElementRef<HTMLDivElement>;

  private phaser!: Phaser.Game;
  private gameScene!: GameScene;
  private gameId!: string;
  private userId = '';
  private subs: Subscription[] = [];
  private sceneReady = false;

  selectedEntities: Entity[] = [];
  targetingMode: 'walk' | 'attack' | null = null;
  gameFinished = false;
  showSurrenderModal = false;
  winners: string[] = [];
  isWinner = false;
  gameTick = 0;
  elapsedTime = '00:00';
  playerName = '';
  playerColor = '#ccc';
  private tickRateMs = 500;
  private startedAt = 0;
  private peaceUntil = 0;

  get peaceRemaining(): number {
    if (!this.peaceUntil) return 0;
    return Math.max(0, Math.floor((this.peaceUntil - Date.now()) / 1000));
  }

  get selectedSoldiers(): number {
    return this.selectedEntities.filter(e => e.type === 'soldier').length;
  }

  get selectedBarracks(): number {
    return this.selectedEntities.filter(e => e.type === 'barracks').length;
  }

  get hasBusy(): boolean {
    return this.selectedEntities.some(e => e.type === 'soldier' && e.state.status === 'building-barracks');
  }

  get idleSoldiers(): number {
    return this.selectedEntities.filter(e => e.type === 'soldier' && e.state.status === 'idle').length;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: GameApiService,
    private socket: SocketService,
    private auth: AuthService,
    private ngZone: NgZone,
  ) {}

  ngAfterViewInit() {
    this.gameId = this.route.snapshot.paramMap.get('gameId')!;

    this.auth.userData$().pipe(first()).subscribe(data => {
      this.userId = (data['preferred_username'] as string) || '';
      this.initPhaser();
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (this.gameFinished) return;

    switch (e.key.toLowerCase()) {
      case 'q':
        if (this.targetingMode) this.cancelTargeting();
        else if (this.selectedSoldiers > 0) this.startWalk();
        break;
      case 'w':
        if (this.targetingMode) this.cancelTargeting();
        else if (this.selectedSoldiers > 0) this.startAttack();
        break;
      case 'e':
        if (this.targetingMode) this.cancelTargeting();
        else this.buildBarracks();
        break;
      case 'escape':
        if (this.targetingMode) this.cancelTargeting();
        break;
    }
  }

  private initPhaser() {
    this.phaser = new Phaser.Game({
      type: Phaser.AUTO,
      scale: {
        mode: Phaser.Scale.RESIZE,
        parent: this.container.nativeElement,
      },
      backgroundColor: '#1a1a2e',
      scene: [BootScene, GameScene],
    });

    this.phaser.events.on('ready', () => {
      this.gameScene = this.phaser.scene.getScene('GameScene') as GameScene;
      this.gameScene.setPlayerId(this.userId);
      this.sceneReady = true;

      this.api.getGame(this.gameId).subscribe({
        next: (state) => {
          if (!state?.id) { this.router.navigate(['/']); return; }
          this.onState(state);
        },
        error: () => this.router.navigate(['/']),
      });

      this.socket.connectGame();
      this.socket.joinGameRoom(this.gameId);
      this.subs.push(this.socket.stateUpdate$.subscribe(state => {
        if (state.id === this.gameId) this.onState(state);
      }));

      this.subs.push(this.gameScene.onSelectionChanged.subscribe(ids => {
        this.ngZone.run(() => this.onSelection(ids));
      }));
      this.subs.push(this.gameScene.onActionRequest.subscribe(req => {
        this.ngZone.run(() => this.submitAction(req));
      }));
      this.subs.push(this.gameScene.onTargetingChanged.subscribe(action => {
        this.ngZone.run(() => { this.targetingMode = action; });
      }));
    });
  }

  private onState(state: GameState) {
    console.log(`[GameComponent] state: tick=${state.tick} state=${state.state} entities=${state.map.entities.length}`);
    this.gameTick = state.tick;
    this.tickRateMs = state.tickRateMs;
    this.startedAt = state.startedAt;
    this.peaceUntil = state.peaceUntil;
    this.elapsedTime = this.formatElapsed(state.startedAt);
    this.playerName = this.userId;
    this.playerColor = state.playerColors?.[this.userId] || '#ccc';
    this.gameScene.updateFromState(state);
    if (state.state === 'finished') {
      this.gameFinished = true;
      this.winners = state.winners;
      this.isWinner = state.winners.includes(this.userId);
      this.targetingMode = null;
      this.selectedEntities = [];
    }
  }

  private formatElapsed(startedAt: number): string {
    const totalMs = Math.max(0, Date.now() - startedAt);
    const totalSec = Math.floor(totalMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const h = Math.floor(m / 60);
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private onSelection(ids: string[]) {
    const state = this.gameScene.getGameState();
    if (!state) { this.selectedEntities = []; return; }
    this.selectedEntities = ids.map(id => {
      for (const [eid, entity] of state.map.entities) {
        if (eid === id) return entity;
      }
      return null;
    }).filter(Boolean) as Entity[];
  }

  private submitAction(req: { action: string; entityIds: string[]; x: number; y: number }) {
    console.log(`[GameComponent] submitting action: game=${this.gameId} type=${req.action} entities=${req.entityIds.length} target=(${req.x},${req.y})`);
    this.api.submitAction(this.gameId, req.action, {
      entityIds: req.entityIds, x: req.x, y: req.y,
    }).subscribe({
      next: (res) => console.log(`[GameComponent] action accepted: id=${res.actionId}`),
      error: (err) => console.error('[GameComponent] action error:', err),
    });
  }

  startWalk() {
    if (!this.sceneReady || this.selectedSoldiers === 0) return;
    console.log(`[GameComponent] start walk: ${this.selectedSoldiers} soldiers`);
    this.gameScene.startTargeting('walk');
  }

  startAttack() {
    if (!this.sceneReady || this.selectedSoldiers === 0) return;
    console.log(`[GameComponent] start attack: ${this.selectedSoldiers} soldiers`);
    this.gameScene.startTargeting('attack');
  }

  cancelTargeting() {
    console.log('[GameComponent] cancel targeting');
    if (this.sceneReady) this.gameScene.cancelTargeting();
  }

  buildBarracks() {
    this.api.submitAction(this.gameId, 'build_barracks', {
      entityIds: this.selectedEntities.map(e => e.id),
    }).subscribe({
      next: (res) => console.log(`[GameComponent] build accepted: id=${res.actionId}`),
      error: (err) => console.error('[GameComponent] build error:', err),
    });
  }

  surrender() {
    this.showSurrenderModal = false;
    this.api.submitAction(this.gameId, 'surrender', {}).subscribe();
    this.router.navigate(['/']);
  }

  leaveGame() { this.router.navigate(['/']); }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    this.socket.leaveGameRoom(this.gameId);
    this.socket.disconnectGame();
    this.phaser?.destroy(true);
  }
}
