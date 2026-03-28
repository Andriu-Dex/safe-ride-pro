import { Inject, Injectable } from '@nestjs/common';

import {
  VEHICLES_REPOSITORY,
  VehiclesRepository,
} from '../ports/vehicles.repository';

@Injectable()
export class ListLicenseTypesUseCase {
  constructor(
    @Inject(VEHICLES_REPOSITORY)
    private readonly vehiclesRepository: VehiclesRepository,
  ) {}

  async execute() {
    return this.vehiclesRepository.listLicenseTypes();
  }
}