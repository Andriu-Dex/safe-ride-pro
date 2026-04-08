import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RealtimeEventsService } from './application/services/realtime-events.service';
import { RealtimeController } from './presentation/controllers/realtime.controller';

@Module({
  imports: [AuthModule],
  controllers: [RealtimeController],
  providers: [RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class RealtimeModule {}
