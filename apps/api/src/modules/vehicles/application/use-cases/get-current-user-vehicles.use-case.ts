import { Inject, Injectable } from '@nestjs/common';

import {
  VEHICLES_REPOSITORY,
  VehiclesRepository,
} from '../ports/vehicles.repository';

@Injectable()
export class GetCurrentUserVehiclesUseCase {
  constructor(
    @Inject(VEHICLES_REPOSITORY)
    private readonly vehiclesRepository: VehiclesRepository,
  ) {}

  async execute(userId: string) {
    const membership = await this.vehiclesRepository.findDefaultMembershipByUserId(userId);

    if (!membership) {
      return {
        membership: null,
        vehicles: [],
      };
    }

    const vehicles = await this.vehiclesRepository.findVehiclesByMembershipId(membership.id);

    return {
      membership,
      vehicles,
    };
  }
}