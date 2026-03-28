import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { GetCurrentUserVehiclesUseCase } from './application/use-cases/get-current-user-vehicles.use-case';
import { ListLicenseTypesUseCase } from './application/use-cases/list-license-types.use-case';
import { ListVehicleBrandsUseCase } from './application/use-cases/list-vehicle-brands.use-case';
import { ListVehicleModelsUseCase } from './application/use-cases/list-vehicle-models.use-case';
import { RegisterVehicleUseCase } from './application/use-cases/register-vehicle.use-case';
import { VEHICLES_REPOSITORY } from './application/ports/vehicles.repository';
import { PrismaVehiclesRepository } from './infrastructure/repositories/prisma-vehicles.repository';
import { VehiclesController } from './presentation/controllers/vehicles.controller';

@Module({
  imports: [AuthModule],
  controllers: [VehiclesController],
  providers: [
    {
      provide: VEHICLES_REPOSITORY,
      useClass: PrismaVehiclesRepository,
    },
    ListLicenseTypesUseCase,
    ListVehicleBrandsUseCase,
    ListVehicleModelsUseCase,
    GetCurrentUserVehiclesUseCase,
    RegisterVehicleUseCase,
  ],
})
export class VehiclesModule {}