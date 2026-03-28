import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';

import {
  TRIP_REQUESTS_REPOSITORY,
  TripRequestsRepository,
} from '../ports/trip-requests.repository';

@Injectable()
export class ListMyTripRequestsUseCase {
  constructor(
    @Inject(TRIP_REQUESTS_REPOSITORY)
    private readonly tripRequestsRepository: TripRequestsRepository,
  ) {}

  async execute(userId: string) {
    const membership = await this.tripRequestsRepository.findDefaultMembershipByUserId(userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para consultar solicitudes.');
    }

    const items = await this.tripRequestsRepository.listTripRequestsByPassengerMembershipId(
      membership.id,
    );

    return {
      items,
    };
  }
}
