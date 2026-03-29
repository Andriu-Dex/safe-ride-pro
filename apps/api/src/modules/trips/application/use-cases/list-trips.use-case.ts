import { Inject, Injectable } from '@nestjs/common';
import { TripStatus } from '@saferidepro/shared-types';

import {
  TRIPS_REPOSITORY,
  TripFilters,
  TripsRepository,
} from '../ports/trips.repository';

export type ListTripsQuery = {
  userId: string;
  mine?: boolean;
  origin?: string;
  destination?: string;
  dateFrom?: string;
  dateTo?: string;
  routeMode?: TripFilters['routeMode'];
  vehicleType?: TripFilters['vehicleType'];
};

@Injectable()
export class ListTripsUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
  ) {}

  async execute(query: ListTripsQuery) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(query.userId);

    if (!membership) {
      return [];
    }

    const filters: TripFilters = {
      originSearch: query.origin?.trim() || undefined,
      destinationSearch: query.destination?.trim() || undefined,
      routeMode: query.routeMode,
      vehicleType: query.vehicleType,
    };

    if (query.dateFrom) {
      filters.dateFrom = new Date(query.dateFrom);
    }

    if (query.dateTo) {
      filters.dateTo = new Date(query.dateTo);
    }

    if (query.mine) {
      filters.driverMembershipId = membership.id;
    } else {
      filters.institutionId = membership.institutionId;
      filters.statuses = [TripStatus.Published, TripStatus.Full];
    }

    const trips = await this.tripsRepository.listTrips(filters);

    return trips.map((trip) => ({
      id: trip.id,
      institutionId: trip.institutionId,
      institutionName: trip.institutionName,
      driverMembershipId: trip.driverMembershipId,
      driverFullName: trip.driverFullName,
      vehicleId: trip.vehicleId,
      vehiclePlate: trip.vehiclePlate,
      vehicleDisplayName: trip.vehicleDisplayName,
      status: trip.status,
      routeMode: trip.routeMode,
      originLabel: trip.originLabel,
      destinationLabel: trip.destinationLabel,
      departureAt: trip.departureAt,
      estimatedArrivalAt: trip.estimatedArrivalAt,
      seatCount: trip.seatCount,
      availableSeats: trip.availableSeats,
      vehicleTypeSnapshot: trip.vehicleTypeSnapshot,
      luggagePolicySnapshot: trip.luggagePolicySnapshot,
      basePriceReference: trip.basePriceReference,
      detourSurchargeReference: trip.detourSurchargeReference,
      notes: trip.notes,
      cancelledAt: trip.cancelledAt,
      cancellationTiming: trip.cancellationTiming,
      createdAt: trip.createdAt,
    }));
  }
}
