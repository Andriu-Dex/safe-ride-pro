import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TRIP_REQUESTS_REPOSITORY } from './application/ports/trip-requests.repository';
import { AcceptTripRequestUseCase } from './application/use-cases/accept-trip-request.use-case';
import { CancelTripRequestUseCase } from './application/use-cases/cancel-trip-request.use-case';
import { CreateTripRequestUseCase } from './application/use-cases/create-trip-request.use-case';
import { ListDriverTripRequestsUseCase } from './application/use-cases/list-driver-trip-requests.use-case';
import { ListMyTripRequestsUseCase } from './application/use-cases/list-my-trip-requests.use-case';
import { RejectTripRequestUseCase } from './application/use-cases/reject-trip-request.use-case';
import { PrismaTripRequestsRepository } from './infrastructure/repositories/prisma-trip-requests.repository';
import { TripRequestsController } from './presentation/controllers/trip-requests.controller';

@Module({
  imports: [AuthModule],
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
  ],
})
export class TripRequestsModule {}
