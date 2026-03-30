import { Module } from '@nestjs/common';

import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { HealthModule } from './modules/health/health.module';
import { InstitutionsModule } from './modules/institutions/institutions.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SanctionsModule } from './modules/sanctions/sanctions.module';
import { TripsModule } from './modules/trips/trips.module';
import { TripRequestsModule } from './modules/trip-requests/trip-requests.module';
import { UsersModule } from './modules/users/users.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { EnvironmentModule } from './shared/infrastructure/config/environment.module';
import { DatabaseModule } from './shared/infrastructure/database/database.module';

@Module({
  imports: [
    EnvironmentModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    InstitutionsModule,
    DriversModule,
    VehiclesModule,
    SanctionsModule,
    TripsModule,
    TripRequestsModule,
    RatingsModule,
    ReportsModule,
    AuditModule,
  ],
})
export class AppModule {}
