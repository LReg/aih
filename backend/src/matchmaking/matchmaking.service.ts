import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Gamemode, GAMEMODE_CONFIGS } from '../game/gamemode.config';
import { GameService } from '../game/game.service';
import { PendingMatch } from './pending-match';
import { PendingMatchDao } from './pending-match-dao';
import { MatchmakingGateway } from './matchmaking.gateway';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class MatchmakingService {
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private dao: PendingMatchDao,
    private gameService: GameService,
    private gateway: MatchmakingGateway,
    @Inject(forwardRef(() => QueueService))
    private queueService: QueueService,
  ) {}

  createMatch(gamemode: Gamemode, players: string[]): PendingMatch {
    const config = GAMEMODE_CONFIGS[gamemode];
    const match = new PendingMatch(gamemode, players, config.startTimerSeconds);
    match.state = 'countdown';
    this.dao.save(match);
    this.startCountdown(match);
    return match;
  }

  addPlayer(matchId: string, userId: string): boolean {
    const match = this.dao.get(matchId);
    if (!match || match.state !== 'countdown') return false;

    const config = GAMEMODE_CONFIGS[match.gamemode];
    if (match.players.length >= config.maxPlayers) return false;

    match.players.push(userId);
    this.gateway.emitCountdownTick(match.gamemode, match.secondsRemaining, match.players);
    return true;
  }

  getActiveMatch(gamemode: Gamemode): PendingMatch | undefined {
    const match = this.dao.getByGamemode(gamemode);
    if (!match || match.state !== 'countdown') return;
    return match;
  }

  removePlayer(matchId: string, userId: string): { requeued: string[] } {
    const match = this.dao.get(matchId);
    if (!match || match.state !== 'countdown') return { requeued: [] };

    const idx = match.players.indexOf(userId);
    if (idx === -1) return { requeued: [] };

    match.players.splice(idx, 1);
    const config = GAMEMODE_CONFIGS[match.gamemode];

    if (match.players.length >= (config.startMinPlayers || 1)) {
      this.gateway.emitCountdownTick(match.gamemode, match.secondsRemaining, match.players);
      return { requeued: [] };
    }

    const survivors = this.cancelMatch(matchId);
    this.gateway.emitRequeued(match.gamemode, survivors);
    return { requeued: survivors };
  }

  cancelMatch(matchId: string): string[] {
    const match = this.dao.get(matchId);
    if (!match) return [];

    this.stopCountdown(matchId);
    match.state = 'cancelled';
    const players = [...match.players];
    this.dao.delete(matchId);
    return players;
  }

  private startCountdown(match: PendingMatch) {
    this.gateway.emitCountdownTick(match.gamemode, match.secondsRemaining, match.players);

    this.timers.set(match.id, setInterval(() => {
      match.secondsRemaining--;

      if (match.secondsRemaining <= 0) {
        this.stopCountdown(match.id);
        this.launch(match);
        return;
      }

      this.gateway.emitCountdownTick(match.gamemode, match.secondsRemaining, match.players);
    }, 1000));
  }

  private stopCountdown(matchId: string) {
    const timer = this.timers.get(matchId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(matchId);
    }
  }

  private launch(match: PendingMatch) {
    const config = GAMEMODE_CONFIGS[match.gamemode];
    if (!config) return;

    match.state = 'launched';
    const gameId = this.gameService.launchGame(match.players, match.gamemode, config);
    this.dao.delete(match.id);
    this.gateway.emitGameFound(match.gamemode, gameId, match.players);
    this.queueService.checkForNewMatch(match.gamemode);
  }
}
