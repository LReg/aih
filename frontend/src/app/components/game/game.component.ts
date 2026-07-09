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
      <div #phaserContainer class="phaser-container"></div>

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
            } @else if (selectedSoldiers > 0) {
              <button class="cbtn" (click)="startWalk()">
                <span class="keyhint">Q</span>
                Move
              </button>
              <button class="cbtn" (click)="startAttack()">
                <span class="keyhint">W</span>
                Attack
              </button>
              @if (idleSoldiers > 0) {
                <button class="cbtn" (click)="buildBarracks()">
                  <span class="keyhint">E</span>
                  Build
                </button>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .game-layout {
      width: 100vw; height: 100vh;
      display: flex; flex-direction: column;
      background: #1a1a2e; overflow: hidden;
    }
    .phaser-container { flex: 1; min-height: 0; }

    .cmd-bar {
      display: flex; align-items: center;
      justify-content: space-between;
      padding: 6px 16px;
      background: linear-gradient(180deg, #0d0d1a 0%, #141428 100%);
      border-top: 1px solid #2a2a45;
      box-shadow: 0 -2px 8px rgba(0,0,0,.4);
      min-height: 48px; gap: 12px;
    }
    .cmd-left { display: flex; align-items: center; gap: 8px; }
    .sel-count {
      font-size: 18px; font-weight: 700;
      color: #e8e8f0; min-width: 28px; text-align: center;
    }
    .sel-type { font-size: 13px; color: #e8e8f0; }
    .sel-type .dim { color: #7070a0; font-weight: 400; }
    .sel-type.busy { color: #ff8800; font-weight: 600; }

    .cmd-buttons { display: flex; align-items: center; gap: 6px; }

    .cbtn {
      position: relative;
      display: flex; flex-direction: column; align-items: center;
      padding: 5px 16px 4px;
      border: 1px solid #2a2a45;
      border-radius: 4px;
      background: #1a1a2e;
      color: #c0c0d0;
      font-size: 12px; font-weight: 500;
      cursor: pointer;
      min-width: 60px;
      transition: background .1s, border-color .1s, color .1s;
    }
    .cbtn:hover:not(.disabled) { background: #2a2a45; border-color: #6c5ce7; color: #e8e8f0; }
    .cbtn.disabled { opacity: .3; cursor: default; }
    .cbtn.cancel { flex-direction: row; gap: 4px; color: #e74c3c; border-color: #4a2020; }
    .cbtn.cancel:hover { background: #2a1515; }

    .keyhint {
      position: absolute; top: -7px; right: -7px;
      font-size: 9px; font-weight: 700;
      background: #2a2a45; color: #6c5ce7;
      border: 1px solid #3a3a55;
      border-radius: 3px;
      padding: 0 4px; line-height: 14px;
      min-width: 16px; text-align: center;
    }

    .target-hint {
      font-size: 12px; color: #ffcc00; font-weight: 500;
      margin-right: 4px;
    }

    .game-over {
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,.75);
      z-index: 2000;
    }
    .game-over h2 { font-size: 36px; margin: 0 0 12px; color: #e8e8f0; }
    .game-over p { margin: 0 0 8px; font-size: 18px; }
    .winner { color: #5ce75c; font-weight: 700; }
    .loser { color: #ff4444; font-weight: 700; }
    .winners-list { color: #9090b0; font-size: 14px !important; }
    .btn-leave {
      margin-top: 16px; padding: 8px 24px;
      border: 1px solid #e74c3c; border-radius: 6px;
      background: transparent; color: #e74c3c;
      cursor: pointer; font-size: 14px;
    }
    .btn-leave:hover { background: #2a1515; }
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
  winners: string[] = [];
  isWinner = false;

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
        else if (this.idleSoldiers > 0) this.buildBarracks();
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
    this.gameScene.updateFromState(state);
    if (state.state === 'finished') {
      this.gameFinished = true;
      this.winners = state.winners;
      this.isWinner = state.winners.includes(this.userId);
      this.targetingMode = null;
      this.selectedEntities = [];
    }
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
    if (!this.sceneReady) { console.warn('[GameComponent] build: scene not ready'); return; }
    const soldiers = this.selectedEntities.filter(e => e.type === 'soldier' && e.state.status === 'idle');
    if (soldiers.length === 0) { console.warn('[GameComponent] build: no idle soldiers'); return; }
    const ids = soldiers.map(e => e.id);
    console.log(`[GameComponent] build barracks: ${ids.length} idle soldiers`);
    this.api.submitAction(this.gameId, 'build_barracks', {
      entityIds: ids,
    }).subscribe({
      next: (res) => console.log(`[GameComponent] build accepted: id=${res.actionId}`),
      error: (err) => console.error('[GameComponent] build error:', err),
    });
  }

  leaveGame() { this.router.navigate(['/']); }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    this.socket.leaveGameRoom(this.gameId);
    this.socket.disconnectGame();
    this.phaser?.destroy(true);
  }
}
