import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';

import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';

@Injectable()
export class GetLatestTripRouteTemplateUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
  ) {}

  async execute(userId: string) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para reutilizar rutas.');
    }

    const trip = await this.tripsRepository.findLatestReusableTripByDriverMembershipId(membership.id);

    if (!trip) {
      return null;
    }

    return {
      sourceTripId: trip.id,
      vehicleId: trip.vehicleId,
      routeMode: trip.routeMode,
      originLabel: trip.originLabel,
      destinationLabel: trip.destinationLabel,
      originLatitude: trip.originLatitude,
      originLongitude: trip.originLongitude,
      destinationLatitude: trip.destinationLatitude,
      destinationLongitude: trip.destinationLongitude,
      seatCount: trip.seatCount,
      basePriceReference: trip.basePriceReference,
      detourSurchargeReference: trip.detourSurchargeReference,
      notes: trip.notes,
      createdAt: trip.createdAt,
      departureAt: trip.departureAt,
      vehicleDisplayName: trip.vehicleDisplayName,
      vehiclePlate: trip.vehiclePlate,
    };
  }
}
