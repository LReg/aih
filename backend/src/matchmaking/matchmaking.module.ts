import { Module, forwardRef } from '@nestjs/common';
import { GameModule } from '../game/game.module';
import { QueueModule } from '../queue/queue.module';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingGateway } from './matchmaking.gateway';
import { PendingMatchDao } from './pending-match-dao';

@Module({
  imports: [GameModule, forwardRef(() => QueueModule)],
  providers: [MatchmakingService, MatchmakingGateway, PendingMatchDao],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
