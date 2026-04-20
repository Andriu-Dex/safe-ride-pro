import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';

import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';
import { mapTripLiveTrackingResponse } from '../services/trip-live-tracking-response';
import { TripLifecycleMaintenanceService } from '../services/trip-lifecycle-maintenance.service';

@Injectable()
export class GetTripLiveTrackingUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
    private readonly tripLifecycleMaintenanceService: TripLifecycleMaintenanceService,
  ) {}

  async execute(userId: string, tripId: string) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para consultar seguimiento.');
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

    if (!isOwner && !isAcceptedPassenger) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    const tracking = await this.tripsRepository.getTripLiveTrackingByTripId(tripId);

    if (!tracking) {
      throw new NotFoundException('No existe una sesion de seguimiento para este viaje.');
    }

    return mapTripLiveTrackingResponse(tracking);
  }
}
