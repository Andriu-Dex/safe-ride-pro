import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TRIPS_REPOSITORY } from './application/ports/trips.repository';
import { CancelTripUseCase } from './application/use-cases/cancel-trip.use-case';
import { CompleteTripUseCase } from './application/use-cases/complete-trip.use-case';
import { CreateTripUseCase } from './application/use-cases/create-trip.use-case';
import { GetTripByIdUseCase } from './application/use-cases/get-trip-by-id.use-case';
import { GetLatestTripRouteTemplateUseCase } from './application/use-cases/get-latest-trip-route-template.use-case';
import { GetTripLiveTrackingUseCase } from './application/use-cases/get-trip-live-tracking.use-case';
import { ListTripsUseCase } from './application/use-cases/list-trips.use-case';
import { PublishTripUseCase } from './application/use-cases/publish-trip.use-case';
import { StartTripUseCase } from './application/use-cases/start-trip.use-case';
import { UpdateTripUseCase } from './application/use-cases/update-trip.use-case';
import { UpdateTripLiveTrackingUseCase } from './application/use-cases/update-trip-live-tracking.use-case';
import { TripLifecycleMaintenanceService } from './application/services/trip-lifecycle-maintenance.service';
import { PrismaTripsRepository } from './infrastructure/repositories/prisma-trips.repository';
import { TripsController } from './presentation/controllers/trips.controller';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [TripsController],
  providers: [
    {
      provide: TRIPS_REPOSITORY,
      useClass: PrismaTripsRepository,
    },
    CreateTripUseCase,
    ListTripsUseCase,
    GetTripByIdUseCase,
    GetLatestTripRouteTemplateUseCase,
    GetTripLiveTrackingUseCase,
    PublishTripUseCase,
    StartTripUseCase,
    UpdateTripUseCase,
    CompleteTripUseCase,
    CancelTripUseCase,
    UpdateTripLiveTrackingUseCase,
    TripLifecycleMaintenanceService,
  ],
})
export class TripsModule {}
