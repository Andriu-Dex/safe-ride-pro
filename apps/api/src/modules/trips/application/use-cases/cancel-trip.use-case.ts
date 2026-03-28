import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TripStatus } from '@saferidepro/shared-types';

import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';

@Injectable()
export class CancelTripUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
  ) {}

  async execute(userId: string, tripId: string) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(userId);

    if (!membership) {
      throw new ForbiddenException('No tienes una membresía activa para cancelar viajes.');
    }

    const trip = await this.tripsRepository.findTripById(tripId);

    if (!trip) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    if (trip.driverMembershipId !== membership.id) {
      throw new ForbiddenException('Solo el conductor dueño puede cancelar este viaje.');
    }

    if (trip.status === TripStatus.InProgress || trip.status === TripStatus.Completed) {
      throw new BadRequestException('No se puede cancelar un viaje que ya inició o finalizó.');
    }

    if (trip.status === TripStatus.Cancelled) {
      throw new BadRequestException('El viaje ya se encuentra cancelado.');
    }

    const updatedTrip = await this.tripsRepository.updateTripStatus(trip.id, TripStatus.Cancelled);

    return {
      message: 'Viaje cancelado correctamente.',
      trip: updatedTrip,
    };
  }
}