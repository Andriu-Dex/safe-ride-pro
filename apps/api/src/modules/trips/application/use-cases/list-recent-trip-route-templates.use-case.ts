import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';

import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';

const RECENT_ROUTE_LIMIT = 5;

@Injectable()
export class ListRecentTripRouteTemplatesUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
  ) {}

  async execute(userId: string) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para reutilizar rutas.');
    }

    const trips = await this.tripsRepository.listRecentReusableTripsByDriverMembershipId(
      membership.id,
      RECENT_ROUTE_LIMIT,
    );

    return trips.map((trip) => ({
      sourceTripId: trip.id,
      vehicleId: trip.vehicleId,
      routeMode: trip.routeMode,
      originLabel: trip.originLabel,
      destinationLabel: trip.destinationLabel,
      originLatitude: trip.originLatitude,
      originLongitude: trip.originLongitude,
      destinationLatitude: trip.destinationLatitude,
      destinationLongitude: trip.destinationLongitude,
      routePath: trip.routePath,
      routeDistanceMeters: trip.routeDistanceMeters,
      routeDurationSeconds: trip.routeDurationSeconds,
      seatCount: trip.seatCount,
      basePriceReference: trip.basePriceReference,
      detourSurchargeReference: trip.detourSurchargeReference,
      notes: trip.notes,
      createdAt: trip.createdAt,
      departureAt: trip.departureAt,
      vehicleDisplayName: trip.vehicleDisplayName,
      vehiclePlate: trip.vehiclePlate,
    }));
  }
}
