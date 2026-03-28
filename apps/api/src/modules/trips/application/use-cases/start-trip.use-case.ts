import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TripStatus } from '@saferidepro/shared-types';

import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';

@Injectable()
export class StartTripUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
  ) {}

  async execute(userId: string, tripId: string) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(userId);

    if (!membership) {
      throw new ForbiddenException('No tienes una membresía activa para iniciar viajes.');
    }

    const trip = await this.tripsRepository.findTripById(tripId);

    if (!trip) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    if (trip.driverMembershipId !== membership.id) {
      throw new ForbiddenException('Solo el conductor dueño puede iniciar este viaje.');
    }

    if (trip.status !== TripStatus.Published && trip.status !== TripStatus.Full) {
      throw new BadRequestException('Solo los viajes publicados pueden iniciarse.');
    }

    const updatedTrip = await this.tripsRepository.updateTripStatus(trip.id, TripStatus.InProgress);

    return {
      message: 'Viaje iniciado correctamente.',
      trip: updatedTrip,
    };
  }
}