import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';

@Injectable()
export class GetTripByIdUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
  ) {}

  async execute(userId: string, tripId: string) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(userId);

    if (!membership) {
      throw new ForbiddenException('No tienes una membresía activa para consultar viajes.');
    }

    const trip = await this.tripsRepository.findTripById(tripId);

    if (!trip) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    if (trip.institutionId !== membership.institutionId) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    const isOwner = trip.driverMembershipId === membership.id;

    return {
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
      originLatitude: isOwner ? trip.originLatitude : null,
      originLongitude: isOwner ? trip.originLongitude : null,
      destinationLatitude: isOwner ? trip.destinationLatitude : null,
      destinationLongitude: isOwner ? trip.destinationLongitude : null,
      departureAt: trip.departureAt,
      estimatedArrivalAt: trip.estimatedArrivalAt,
      seatCount: trip.seatCount,
      availableSeats: trip.availableSeats,
      vehicleTypeSnapshot: trip.vehicleTypeSnapshot,
      luggagePolicySnapshot: trip.luggagePolicySnapshot,
      basePriceReference: trip.basePriceReference,
      detourSurchargeReference: trip.detourSurchargeReference,
      notes: trip.notes,
      createdAt: trip.createdAt,
    };
  }
}