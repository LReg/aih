import { Module, forwardRef } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { QueueDao } from './queue-dao';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';

@Module({
  imports: [forwardRef(() => MatchmakingModule)],
  controllers: [QueueController],
  providers: [QueueService, QueueDao],
  exports: [QueueService],
})
export class QueueModule {}
