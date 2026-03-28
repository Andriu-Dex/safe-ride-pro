import { Inject, Injectable } from '@nestjs/common';

import {
  DRIVERS_REPOSITORY,
  DriversRepository,
} from '../ports/drivers.repository';

@Injectable()
export class GetCurrentDriverProfileUseCase {
  constructor(
    @Inject(DRIVERS_REPOSITORY)
    private readonly driversRepository: DriversRepository,
  ) {}

  async execute(userId: string) {
    const membership = await this.driversRepository.findDefaultMembershipByUserId(userId);

    if (!membership) {
      return {
        membership: null,
        driverProfile: null,
      };
    }

    const driverProfile = await this.driversRepository.findDriverProfileByMembershipId(membership.id);

    return {
      membership,
      driverProfile,
    };
  }
}