import { VehicleType } from '@saferidepro/shared-types';
import { Inject, Injectable } from '@nestjs/common';

import {
  VEHICLES_REPOSITORY,
  VehiclesRepository,
} from '../ports/vehicles.repository';

@Injectable()
export class ListVehicleBrandsUseCase {
  constructor(
    @Inject(VEHICLES_REPOSITORY)
    private readonly vehiclesRepository: VehiclesRepository,
  ) {}

  async execute(filters?: { vehicleType?: VehicleType }) {
    return this.vehiclesRepository.listVehicleBrands(filters);
  }
}
