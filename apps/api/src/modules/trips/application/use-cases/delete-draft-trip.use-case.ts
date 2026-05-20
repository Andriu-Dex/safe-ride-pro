import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, TripStatus } from '@saferidepro/shared-types';

import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';

@Injectable()
export class DeleteDraftTripUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
  ) {}

  async execute(userId: string, tripId: string) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para eliminar viajes.');
    }

    const trip = await this.tripsRepository.findTripById(tripId);

    if (!trip) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    if (trip.driverMembershipId !== membership.id) {
      throw new ForbiddenException('Solo el conductor duenio puede eliminar este viaje.');
    }

    if (trip.status !== TripStatus.Draft) {
      throw new BadRequestException('Solo se pueden eliminar viajes que aun no han sido publicados.');
    }

    const activeRequests = await this.tripsRepository.countActiveRequestsForTrip(trip.id);

    if (activeRequests > 0) {
      throw new BadRequestException('No se puede eliminar un viaje con solicitudes activas.');
    }

    await this.tripsRepository.deleteDraftTrip(trip.id);

    return {
      message: 'Viaje eliminado correctamente.',
    };
  }
}
