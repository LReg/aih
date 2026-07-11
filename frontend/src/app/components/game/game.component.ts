import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { first, Subscription } from 'rxjs';
import Phaser from 'phaser';
import { GameApiService } from '../../service/game-api.service';
import { SocketService } from '../../service/socket.service';
import { AuthService } from '../../service/auth/auth.service';
import { GameState, GameStateDiff, StateUpdate, Entity } from '../../types/game.types';
import { BootScene } from './scenes/boot-scene';
import { GameScene } from './scenes/game-scene';

@Component({
  selector: 'app-game',
  standalone: true,
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('phaserContainer') container!: ElementRef<HTMLDivElement>;

  private phaser!: Phaser.Game;
  private gameScene!: GameScene;
  private gameId!: string;
  private userId = '';
  private subs: Subscription[] = [];
  private sceneReady = false;
  private tickRateMs = 500;
  private startedAt = 0;
  private peaceUntil = 0;

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
    return this.selectedEntities.some(
      e => e.type === 'soldier' && e.state.status === 'building-barracks',
    );
  }

  get idleSoldiers(): number {
    return this.selectedEntities.filter(
      e => e.type === 'soldier' && e.state.status === 'idle',
    ).length;
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
      scale: { mode: Phaser.Scale.RESIZE, parent: this.container.nativeElement },
      backgroundColor: '#1a1a2e',
      scene: [BootScene, GameScene],
    });

    this.phaser.events.on('ready', () => {
      this.gameScene = this.phaser.scene.getScene('GameScene') as GameScene;
      this.gameScene.setPlayerId(this.userId);
      this.sceneReady = true;

      this.fetchInitialState();
      this.listenToSocket();
      this.listenToSceneEvents();
    });
  }

  private fetchInitialState() {
    this.api.getGame(this.gameId).subscribe({
      next: (state) => {
        if (!state?.id) { this.router.navigate(['/']); return; }
        this.applyState(state);
      },
      error: () => this.router.navigate(['/']),
    });
  }

  private listenToSocket() {
    this.socket.connectGame();
    this.socket.joinGameRoom(this.gameId);
    this.subs.push(this.socket.stateUpdate$.subscribe((update: StateUpdate) => {
      if ('diff' in update && update.diff) {
        this.applyDiff(update as GameStateDiff);
        return;
      }
      if ((update as GameState).id === this.gameId) {
        this.applyState(update as GameState);
      }
    }));
  }

  private listenToSceneEvents() {
    this.subs.push(this.gameScene.onSelectionChanged.subscribe(ids => {
      this.ngZone.run(() => this.syncSelection(ids));
    }));
    this.subs.push(this.gameScene.onActionRequest.subscribe(req => {
      this.ngZone.run(() => this.submitAction(req));
    }));
    this.subs.push(this.gameScene.onTargetingChanged.subscribe(action => {
      this.ngZone.run(() => { this.targetingMode = action; });
    }));
  }

  private applyState(state: GameState) {
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

  private applyDiff(diff: GameStateDiff) {
    this.gameTick = diff.tick;
    this.gameScene.updateFromState(diff);
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

  private syncSelection(ids: string[]) {
    this.selectedEntities = ids.map(id => this.gameScene.getEntity(id)).filter(Boolean) as Entity[];
  }

  private submitAction(req: { action: string; entityIds: string[]; x: number; y: number }) {
    this.api.submitAction(this.gameId, req.action, {
      entityIds: req.entityIds, x: req.x, y: req.y,
    }).subscribe();
  }

  startWalk() {
    if (!this.sceneReady || this.selectedSoldiers === 0) return;
    this.gameScene.startTargeting('walk');
  }

  startAttack() {
    if (!this.sceneReady || this.selectedSoldiers === 0) return;
    this.gameScene.startTargeting('attack');
  }

  cancelTargeting() {
    if (this.sceneReady) this.gameScene.cancelTargeting();
  }

  buildBarracks() {
    this.api.submitAction(this.gameId, 'build_barracks', {
      entityIds: this.selectedEntities.map(e => e.id),
    }).subscribe();
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
    this.gameScene?.onSelectionChanged?.complete();
    this.gameScene?.onActionRequest?.complete();
    this.gameScene?.onTargetingChanged?.complete();
    this.phaser?.destroy(true);
  }
}
