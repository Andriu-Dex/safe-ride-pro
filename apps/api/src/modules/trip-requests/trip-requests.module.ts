import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { InstitutionsModule } from '../institutions/institutions.module';
import { PaymentsModule } from '../payments/payments.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TRIP_REQUESTS_REPOSITORY } from './application/ports/trip-requests.repository';
import { AcceptTripRequestUseCase } from './application/use-cases/accept-trip-request.use-case';
import { CancelTripRequestUseCase } from './application/use-cases/cancel-trip-request.use-case';
import { CreateTripRequestUseCase } from './application/use-cases/create-trip-request.use-case';
import { ListDriverTripRequestsUseCase } from './application/use-cases/list-driver-trip-requests.use-case';
import { ListMyTripRequestsUseCase } from './application/use-cases/list-my-trip-requests.use-case';
import { MarkTripRequestBoardedUseCase } from './application/use-cases/mark-trip-request-boarded.use-case';
import { MarkTripRequestDroppedOffUseCase } from './application/use-cases/mark-trip-request-dropped-off.use-case';
import { MarkTripRequestNoShowUseCase } from './application/use-cases/mark-trip-request-no-show.use-case';
import { RejectTripRequestUseCase } from './application/use-cases/reject-trip-request.use-case';
import { PrismaTripRequestsRepository } from './infrastructure/repositories/prisma-trip-requests.repository';
import { TripRequestsController } from './presentation/controllers/trip-requests.controller';

@Module({
  imports: [AuthModule, RealtimeModule, InstitutionsModule, PaymentsModule],
  controllers: [TripRequestsController],
  providers: [
    {
      provide: TRIP_REQUESTS_REPOSITORY,
      useClass: PrismaTripRequestsRepository,
    },
    CreateTripRequestUseCase,
    ListMyTripRequestsUseCase,
    ListDriverTripRequestsUseCase,
    AcceptTripRequestUseCase,
    RejectTripRequestUseCase,
    CancelTripRequestUseCase,
    MarkTripRequestBoardedUseCase,
    MarkTripRequestDroppedOffUseCase,
    MarkTripRequestNoShowUseCase,
  ],
})
export class TripRequestsModule {}
