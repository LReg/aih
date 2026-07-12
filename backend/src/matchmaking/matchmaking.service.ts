import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { Gamemode, GAMEMODE_CONFIGS } from '../game/gamemode.config';
import { GameService } from '../game/game.service';
import { PendingMatch } from './pending-match';
import { PendingMatchDao } from './pending-match-dao';
import { MatchmakingGateway } from './matchmaking.gateway';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private dao: PendingMatchDao,
    private gameService: GameService,
    private gateway: MatchmakingGateway,
    @Inject(forwardRef(() => QueueService))
    private queueService: QueueService,
  ) {}

  createMatch(gamemode: Gamemode, players: string[]): PendingMatch {
    this.logger.log(`createMatch gamemode="${gamemode}" players=[${players}]`);
    const config = GAMEMODE_CONFIGS[gamemode];
    const match = new PendingMatch(gamemode, players, config.startTimerSeconds);
    match.state = 'countdown';
    this.dao.save(match);
    this.startCountdown(match);
    return match;
  }

  addPlayer(matchId: string, userId: string): boolean {
    this.logger.log(`addPlayer matchId="${matchId}" userId="${userId}"`);
    const match = this.dao.get(matchId);
    if (!match || match.state !== 'countdown') {
      this.logger.log(`addPlayer failed: match not found or not in countdown`);
      return false;
    }

    const config = GAMEMODE_CONFIGS[match.gamemode];
    if (match.players.length >= config.maxPlayers) {
      this.logger.log(`addPlayer failed: match full (${match.players.length}/${config.maxPlayers})`);
      return false;
    }

    match.players.push(userId);
    this.gateway.emitCountdownTick(match.gamemode, match.secondsRemaining, match.players);
    this.logger.log(`addPlayer success, players now=[${match.players}]`);
    return true;
  }

  getActiveMatch(gamemode: Gamemode): PendingMatch | undefined {
    const match = this.dao.getByGamemode(gamemode);
    if (!match || match.state !== 'countdown') {
      this.logger.log(`getActiveMatch gamemode="${gamemode}": none`);
      return;
    }
    this.logger.log(`getActiveMatch gamemode="${gamemode}": id="${match.id}" players=[${match.players}]`);
    return match;
  }

  removePlayer(matchId: string, userId: string): { requeued: string[] } {
    this.logger.log(`removePlayer matchId="${matchId}" userId="${userId}"`);
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
    this.logger.log(`cancelMatch matchId="${matchId}"`);
    const match = this.dao.get(matchId);
    if (!match) return [];

    this.stopCountdown(matchId);
    match.state = 'cancelled';
    const players = [...match.players];
    this.dao.delete(matchId);
    return players;
  }

  private startCountdown(match: PendingMatch) {
    this.logger.log(`startCountdown matchId="${match.id}" seconds=${match.secondsRemaining}`);
    this.gateway.emitCountdownTick(match.gamemode, match.secondsRemaining, match.players);

    this.timers.set(match.id, setInterval(() => {
      match.secondsRemaining--;

      if (match.secondsRemaining <= 0) {
        this.logger.log(`countdown finished for matchId="${match.id}"`);
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
      this.logger.log(`stopCountdown matchId="${matchId}"`);
    }
  }

  broadcastQueueUpdate(counts: Record<string, number>) {
    this.gateway.emitQueueUpdate(counts);
  }

  private launch(match: PendingMatch) {
    this.logger.log(`launch matchId="${match.id}" gamemode="${match.gamemode}" players=[${match.players}]`);
    const config = GAMEMODE_CONFIGS[match.gamemode];
    if (!config) return;

    match.state = 'launched';
    const gameId = this.gameService.launchGame(match.players, match.gamemode, config);
    this.dao.delete(match.id);
    this.gateway.emitGameFound(match.gamemode, gameId, match.players);
    this.queueService.checkForNewMatch(match.gamemode);
  }
}
