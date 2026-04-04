import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import {
  VEHICLE_DOCUMENT_STORAGE_SERVICE,
} from './application/ports/vehicle-document-storage.service';
import { GetCurrentUserVehiclesUseCase } from './application/use-cases/get-current-user-vehicles.use-case';
import { GetVehicleRegistrationDocumentUseCase } from './application/use-cases/get-vehicle-registration-document.use-case';
import { ListLicenseTypesUseCase } from './application/use-cases/list-license-types.use-case';
import { ListVehicleBrandsUseCase } from './application/use-cases/list-vehicle-brands.use-case';
import { ListVehicleModelsUseCase } from './application/use-cases/list-vehicle-models.use-case';
import { RegisterVehicleUseCase } from './application/use-cases/register-vehicle.use-case';
import { SetVehicleActiveStatusUseCase } from './application/use-cases/set-vehicle-active-status.use-case';
import { UpdateVehicleUseCase } from './application/use-cases/update-vehicle.use-case';
import { UploadVehicleRegistrationDocumentUseCase } from './application/use-cases/upload-vehicle-registration-document.use-case';
import { VEHICLES_REPOSITORY } from './application/ports/vehicles.repository';
import { PrismaVehiclesRepository } from './infrastructure/repositories/prisma-vehicles.repository';
import { LocalVehicleDocumentStorageService } from './infrastructure/storage/local-vehicle-document-storage.service';
import { VehiclesController } from './presentation/controllers/vehicles.controller';

@Module({
  imports: [AuthModule],
  controllers: [VehiclesController],
  providers: [
    {
      provide: VEHICLES_REPOSITORY,
      useClass: PrismaVehiclesRepository,
    },
    {
      provide: VEHICLE_DOCUMENT_STORAGE_SERVICE,
      useClass: LocalVehicleDocumentStorageService,
    },
    ListLicenseTypesUseCase,
    ListVehicleBrandsUseCase,
    ListVehicleModelsUseCase,
    GetCurrentUserVehiclesUseCase,
    UploadVehicleRegistrationDocumentUseCase,
    GetVehicleRegistrationDocumentUseCase,
    RegisterVehicleUseCase,
    UpdateVehicleUseCase,
    SetVehicleActiveStatusUseCase,
  ],
})
export class VehiclesModule {}
