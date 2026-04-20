import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  DriverLicenseStatus,
  getTripStartAvailability,
  MembershipStatus,
  TRIP_START_EARLY_WINDOW_MINUTES,
  TripStatus,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import { OperationalSanctionsService } from '../../../sanctions/application/services/operational-sanctions.service';
import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';
import { TripLifecycleMaintenanceService } from '../services/trip-lifecycle-maintenance.service';

@Injectable()
export class StartTripUseCase {
  private static readonly AUTO_REJECTION_NOTE =
    'Solicitud cerrada automaticamente porque el viaje ya inicio.';

  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
    private readonly auditService: AuditService,
    private readonly operationalSanctionsService: OperationalSanctionsService,
    private readonly tripLifecycleMaintenanceService: TripLifecycleMaintenanceService,
    @Optional()
    private readonly realtimeEventsService: RealtimeEventsService = new RealtimeEventsService(),
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

    await this.operationalSanctionsService.assertDriverOperationsAllowed(membership.id);

    const currentTrip = await this.tripsRepository.findTripById(tripId);

    if (!currentTrip) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    const trip = await this.tripLifecycleMaintenanceService.reconcileTripLifecycle(currentTrip);

    if (trip.driverMembershipId !== membership.id) {
      throw new ForbiddenException('Solo el conductor duenio puede iniciar este viaje.');
    }

    if (trip.status === TripStatus.Cancelled) {
      throw new BadRequestException(
        'Este viaje fue cancelado automaticamente porque la salida programada ya vencio sin que se iniciara a tiempo.',
      );
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
    const tracking = await this.tripsRepository.activateTripLiveTracking(trip.id);
    const recipientMembershipIds = [
      membership.id,
      ...(await this.tripsRepository.findAcceptedPassengerMembershipIds(trip.id)),
    ];

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

    this.realtimeEventsService.publishTripChanged({
      actorUserId: userId,
      institutionId: trip.institutionId,
      reason: 'started',
      tripId: trip.id,
    });

    this.realtimeEventsService.publishTripLiveTrackingUpdated({
      actorUserId: userId,
      institutionId: trip.institutionId,
      tripId: trip.id,
      driverMembershipId: membership.id,
      recipientMembershipIds,
      trackingStatus: tracking.status,
      lastSignalAt: tracking.lastSignalAt,
      currentLatitude: tracking.currentLatitude,
      currentLongitude: tracking.currentLongitude,
      currentAccuracyMeters: tracking.currentAccuracyMeters,
      currentHeadingDegrees: tracking.currentHeadingDegrees,
      currentSpeedKph: tracking.currentSpeedKph,
    });

    return {
      message: 'Viaje iniciado correctamente.',
      trip: updatedTrip,
    };
  }
}
