import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';
import { TripLifecycleMaintenanceService } from '../services/trip-lifecycle-maintenance.service';

@Injectable()
export class GetTripByIdUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
    private readonly tripLifecycleMaintenanceService: TripLifecycleMaintenanceService,
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

    const reconciledTrip = await this.tripLifecycleMaintenanceService.reconcileTripLifecycle(trip);

    if (reconciledTrip.institutionId !== membership.institutionId) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    const isOwner = reconciledTrip.driverMembershipId === membership.id;

    return {
      id: reconciledTrip.id,
      institutionId: reconciledTrip.institutionId,
      institutionName: reconciledTrip.institutionName,
      driverMembershipId: reconciledTrip.driverMembershipId,
      driverFullName: reconciledTrip.driverFullName,
      vehicleId: reconciledTrip.vehicleId,
      vehiclePlate: reconciledTrip.vehiclePlate,
      vehicleDisplayName: reconciledTrip.vehicleDisplayName,
      status: reconciledTrip.status,
      routeMode: reconciledTrip.routeMode,
      originLabel: reconciledTrip.originLabel,
      destinationLabel: reconciledTrip.destinationLabel,
      originLatitude: isOwner ? reconciledTrip.originLatitude : null,
      originLongitude: isOwner ? reconciledTrip.originLongitude : null,
      destinationLatitude: isOwner ? reconciledTrip.destinationLatitude : null,
      destinationLongitude: isOwner ? reconciledTrip.destinationLongitude : null,
      departureAt: reconciledTrip.departureAt,
      estimatedArrivalAt: reconciledTrip.estimatedArrivalAt,
      seatCount: reconciledTrip.seatCount,
      availableSeats: reconciledTrip.availableSeats,
      vehicleTypeSnapshot: reconciledTrip.vehicleTypeSnapshot,
      luggagePolicySnapshot: reconciledTrip.luggagePolicySnapshot,
      basePriceReference: reconciledTrip.basePriceReference,
      detourSurchargeReference: reconciledTrip.detourSurchargeReference,
      notes: reconciledTrip.notes,
      createdAt: reconciledTrip.createdAt,
    };
  }
}
