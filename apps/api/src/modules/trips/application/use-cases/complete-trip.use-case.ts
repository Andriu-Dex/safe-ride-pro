import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TripStatus } from '@saferidepro/shared-types';

import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';

@Injectable()
export class CompleteTripUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
  ) {}

  async execute(userId: string, tripId: string) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(userId);

    if (!membership) {
      throw new ForbiddenException('No tienes una membresía activa para finalizar viajes.');
    }

    const trip = await this.tripsRepository.findTripById(tripId);

    if (!trip) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    if (trip.driverMembershipId !== membership.id) {
      throw new ForbiddenException('Solo el conductor dueño puede finalizar este viaje.');
    }

    if (trip.status !== TripStatus.InProgress) {
      throw new BadRequestException('Solo los viajes en curso pueden finalizarse.');
    }

    const updatedTrip = await this.tripsRepository.updateTripStatus(trip.id, TripStatus.Completed);

    return {
      message: 'Viaje finalizado correctamente.',
      trip: updatedTrip,
    };
  }
}