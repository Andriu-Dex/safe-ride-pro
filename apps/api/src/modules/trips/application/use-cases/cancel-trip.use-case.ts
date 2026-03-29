import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, TripStatus } from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';

@Injectable()
export class CancelTripUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(userId: string, tripId: string) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para cancelar viajes.');
    }

    const trip = await this.tripsRepository.findTripById(tripId);

    if (!trip) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    if (trip.driverMembershipId !== membership.id) {
      throw new ForbiddenException('Solo el conductor duenio puede cancelar este viaje.');
    }

    if (trip.status === TripStatus.InProgress || trip.status === TripStatus.Completed) {
      throw new BadRequestException('No se puede cancelar un viaje que ya inicio o finalizo.');
    }

    if (trip.status === TripStatus.Cancelled) {
      throw new BadRequestException('El viaje ya se encuentra cancelado.');
    }

    const updatedTrip = await this.tripsRepository.cancelTripAndActiveRequests(trip.id);

    await this.auditService.record({
      institutionId: trip.institutionId,
      actorUserId: userId,
      action: AuditAction.TripCancelled,
      entityType: AuditEntityType.Trip,
      entityId: trip.id,
      metadata: {
        status: updatedTrip.status,
      },
    });

    return {
      message: 'Viaje cancelado correctamente.',
      trip: updatedTrip,
    };
  }
}
