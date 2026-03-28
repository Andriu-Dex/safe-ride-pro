import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TripStatus } from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';

@Injectable()
export class PublishTripUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(userId: string, tripId: string) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(userId);

    if (!membership) {
      throw new ForbiddenException('No tienes una membresia activa para publicar viajes.');
    }

    const trip = await this.tripsRepository.findTripById(tripId);

    if (!trip) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    if (trip.driverMembershipId !== membership.id) {
      throw new ForbiddenException('Solo el conductor duenio puede publicar este viaje.');
    }

    if (trip.status !== TripStatus.Draft) {
      throw new BadRequestException('Solo los viajes en borrador pueden publicarse.');
    }

    if (trip.availableSeats > trip.seatCount) {
      throw new BadRequestException('Los cupos disponibles no pueden superar la capacidad del viaje.');
    }

    const overlappingTrips = await this.tripsRepository.findOverlappingTrips(
      trip.driverMembershipId,
      trip.departureAt,
      trip.estimatedArrivalAt,
      trip.id,
    );

    if (overlappingTrips.length > 0) {
      throw new BadRequestException('No puedes publicar viajes con horarios solapados para el mismo conductor.');
    }

    const nextStatus = trip.availableSeats === 0 ? TripStatus.Full : TripStatus.Published;
    const updatedTrip = await this.tripsRepository.updateTripStatus(trip.id, nextStatus);

    await this.auditService.record({
      institutionId: trip.institutionId,
      actorUserId: userId,
      action: AuditAction.TripPublished,
      entityType: AuditEntityType.Trip,
      entityId: trip.id,
      metadata: {
        status: updatedTrip.status,
      },
    });

    return {
      message: 'Viaje publicado correctamente.',
      trip: updatedTrip,
    };
  }
}