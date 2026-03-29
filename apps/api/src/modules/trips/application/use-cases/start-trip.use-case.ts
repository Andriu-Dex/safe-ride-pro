import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DriverLicenseStatus,
  getTripStartAvailability,
  MembershipStatus,
  TRIP_START_EARLY_WINDOW_MINUTES,
  TripStatus,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';

@Injectable()
export class StartTripUseCase {
  private static readonly AUTO_REJECTION_NOTE =
    'Solicitud cerrada automaticamente porque el viaje ya inicio.';

  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(userId: string, tripId: string) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para iniciar viajes.');
    }

    if (membership.licenseStatus === DriverLicenseStatus.Expired) {
      throw new ForbiddenException(
        'Tu licencia vencio. Debes actualizarla antes de iniciar viajes.',
      );
    }

    const trip = await this.tripsRepository.findTripById(tripId);

    if (!trip) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    if (trip.driverMembershipId !== membership.id) {
      throw new ForbiddenException('Solo el conductor duenio puede iniciar este viaje.');
    }

    if (trip.status !== TripStatus.Published && trip.status !== TripStatus.Full) {
      throw new BadRequestException('Solo los viajes publicados pueden iniciarse.');
    }

    const startAvailability = getTripStartAvailability({
      departureAt: trip.departureAt,
      estimatedArrivalAt: trip.estimatedArrivalAt,
    });

    if (startAvailability === 'TOO_EARLY') {
      throw new BadRequestException(
        `Solo puedes iniciar el viaje dentro de los ${TRIP_START_EARLY_WINDOW_MINUTES} minutos previos a la salida programada.`,
      );
    }

    if (startAvailability === 'TOO_LATE') {
      throw new BadRequestException(
        'No puedes iniciar un viaje cuya llegada estimada ya vencio.',
      );
    }

    const updatedTrip = await this.tripsRepository.startTripAndClosePendingRequests(
      trip.id,
      StartTripUseCase.AUTO_REJECTION_NOTE,
    );

    await this.auditService.record({
      institutionId: trip.institutionId,
      actorUserId: userId,
      action: AuditAction.TripStarted,
      entityType: AuditEntityType.Trip,
      entityId: trip.id,
      metadata: {
        status: updatedTrip.status,
      },
    });

    return {
      message: 'Viaje iniciado correctamente.',
      trip: updatedTrip,
    };
  }
}
