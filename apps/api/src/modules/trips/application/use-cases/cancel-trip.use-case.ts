import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CancellationTiming, MembershipStatus, TripStatus } from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import { TripPaymentsOrchestratorService } from '../../../payments/application/services/trip-payments-orchestrator.service';
import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import { OperationalSanctionsService } from '../../../sanctions/application/services/operational-sanctions.service';
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
    private readonly operationalSanctionsService: OperationalSanctionsService,
    @Optional()
    private readonly tripPaymentsOrchestratorService: Pick<
      TripPaymentsOrchestratorService,
      'cancelTripPayments'
    > = {
      cancelTripPayments: async () => 0,
    },
    @Optional()
    private readonly realtimeEventsService: RealtimeEventsService = new RealtimeEventsService(),
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

    if (
      trip.status !== TripStatus.Draft &&
      updatedTrip.cancellationTiming === CancellationTiming.Late
    ) {
      await this.operationalSanctionsService.synchronizeAutomaticSanctions(membership.id);
    }

    await this.tripPaymentsOrchestratorService.cancelTripPayments(
      trip.id,
      'Pago cancelado porque el viaje fue cancelado por el conductor.',
    );

    const tracking = await this.tripsRepository.endTripLiveTracking(trip.id);

    this.realtimeEventsService.publishTripChanged({
      actorUserId: userId,
      institutionId: trip.institutionId,
      reason: 'cancelled',
      tripId: trip.id,
    });

    if (tracking) {
      this.realtimeEventsService.publishTripLiveTrackingUpdated({
        actorUserId: userId,
        institutionId: trip.institutionId,
        tripId: trip.id,
        driverMembershipId: membership.id,
        recipientMembershipIds: [
          membership.id,
          ...(await this.tripsRepository.findAcceptedPassengerMembershipIds(trip.id)),
        ],
        trackingStatus: tracking.status,
        lastSignalAt: tracking.lastSignalAt,
        currentLatitude: tracking.currentLatitude,
        currentLongitude: tracking.currentLongitude,
        currentAccuracyMeters: tracking.currentAccuracyMeters,
        currentHeadingDegrees: tracking.currentHeadingDegrees,
        currentSpeedKph: tracking.currentSpeedKph,
      });
    }

    return {
      message:
        trip.status === TripStatus.Draft
          ? 'Viaje eliminado correctamente.'
          : 'Viaje cancelado correctamente.',
      trip: updatedTrip,
    };
  }
}
