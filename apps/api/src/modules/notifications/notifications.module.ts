import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NOTIFICATIONS_REPOSITORY } from './application/ports/notifications.repository';
import { NotificationsService } from './application/services/notifications.service';
import { PrismaNotificationsRepository } from './infrastructure/repositories/prisma-notifications.repository';
import { NotificationsController } from './presentation/controllers/notifications.controller';

@Global()
@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [NotificationsController],
  providers: [
    {
      provide: NOTIFICATIONS_REPOSITORY,
      useClass: PrismaNotificationsRepository,
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
