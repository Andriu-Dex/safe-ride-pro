import { Inject, Injectable } from '@nestjs/common';
import { VehicleType } from '@saferidepro/shared-types';

import {
  VEHICLES_REPOSITORY,
  VehiclesRepository,
} from '../ports/vehicles.repository';

@Injectable()
export class ListVehicleModelsUseCase {
  constructor(
    @Inject(VEHICLES_REPOSITORY)
    private readonly vehiclesRepository: VehiclesRepository,
  ) {}

  async execute(filters?: { brandId?: string; vehicleType?: VehicleType }) {
    return this.vehiclesRepository.listVehicleModels(filters);
  }
}