import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  MembershipStatus,
  TripStatus,
} from '@saferidepro/shared-types';

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
    const isAcceptedPassenger = isOwner
      ? false
      : await this.tripsRepository.hasAcceptedTripRequest(tripId, membership.id);
    const canViewPreciseRoute = isOwner || isAcceptedPassenger;
    const activeRequestCount = isOwner
      ? await this.tripsRepository.countActiveRequestsForTrip(tripId)
      : 0;
    const canEdit =
      isOwner &&
      membership.membershipStatus === MembershipStatus.Active &&
      membership.driverVerificationStatus === DriverVerificationStatus.Approved &&
      membership.licenseStatus !== DriverLicenseStatus.Expired &&
      activeRequestCount === 0 &&
      (reconciledTrip.status === TripStatus.Draft ||
        reconciledTrip.status === TripStatus.Published ||
        reconciledTrip.status === TripStatus.Full) &&
      reconciledTrip.departureAt > new Date();
    const canCancel =
      isOwner &&
      reconciledTrip.status !== TripStatus.InProgress &&
      reconciledTrip.status !== TripStatus.Completed &&
      reconciledTrip.status !== TripStatus.Cancelled;

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
      originLatitude: canViewPreciseRoute ? reconciledTrip.originLatitude : null,
      originLongitude: canViewPreciseRoute ? reconciledTrip.originLongitude : null,
      destinationLatitude: canViewPreciseRoute ? reconciledTrip.destinationLatitude : null,
      destinationLongitude: canViewPreciseRoute ? reconciledTrip.destinationLongitude : null,
      routePath: canViewPreciseRoute ? reconciledTrip.routePath : null,
      routeDistanceMeters: canViewPreciseRoute ? reconciledTrip.routeDistanceMeters : null,
      routeDurationSeconds: canViewPreciseRoute ? reconciledTrip.routeDurationSeconds : null,
      departureAt: reconciledTrip.departureAt,
      estimatedArrivalAt: reconciledTrip.estimatedArrivalAt,
      seatCount: reconciledTrip.seatCount,
      availableSeats: reconciledTrip.availableSeats,
      vehicleTypeSnapshot: reconciledTrip.vehicleTypeSnapshot,
      luggagePolicySnapshot: reconciledTrip.luggagePolicySnapshot,
      basePriceReference: reconciledTrip.basePriceReference,
      detourSurchargeReference: reconciledTrip.detourSurchargeReference,
      notes: reconciledTrip.notes,
      closureNote: reconciledTrip.closureNote,
      cancelledAt: reconciledTrip.cancelledAt,
      completedAt: reconciledTrip.completedAt,
      cancellationTiming: reconciledTrip.cancellationTiming,
      createdAt: reconciledTrip.createdAt,
      isOwner,
      isAcceptedPassenger,
      canViewPreciseRoute,
      canEdit,
      canCancel,
    };
  }
}
