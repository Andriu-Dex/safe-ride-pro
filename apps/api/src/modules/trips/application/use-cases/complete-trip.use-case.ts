import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  isTripRequestExecutionResolved,
  MembershipStatus,
  TRIP_FORCE_CLOSURE_NOTE_MIN_LENGTH,
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';

@Injectable()
export class CompleteTripUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
    private readonly auditService: AuditService,
    @Optional()
    private readonly realtimeEventsService: RealtimeEventsService = new RealtimeEventsService(),
  ) {}

  async execute(userId: string, tripId: string, closureNote?: string) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para finalizar viajes.');
    }

    const trip = await this.tripsRepository.findTripById(tripId);

    if (!trip) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    if (trip.driverMembershipId !== membership.id) {
      throw new ForbiddenException('Solo el conductor duenio puede finalizar este viaje.');
    }

    if (trip.status !== TripStatus.InProgress) {
      throw new BadRequestException('Solo los viajes en curso pueden finalizarse.');
    }

    const participants = await this.tripsRepository.listTripExecutionPassengers(trip.id);
    const unresolvedParticipants = participants.filter(
      (participant) =>
        participant.status === TripRequestStatus.Accepted &&
        !isTripRequestExecutionResolved(participant.executionStatus),
    );
    const normalizedClosureNote = closureNote?.trim() || null;

    if (
      unresolvedParticipants.length > 0 &&
      (!normalizedClosureNote ||
        normalizedClosureNote.length < TRIP_FORCE_CLOSURE_NOTE_MIN_LENGTH)
    ) {
      throw new BadRequestException(
        'Antes de finalizar el viaje debes cerrar a todos los pasajeros o registrar una nota de cierre excepcional.',
      );
    }

    const completionDate = new Date();
    const updatedTrip = await this.tripsRepository.completeTrip({
      tripId: trip.id,
      completedAt: completionDate,
      closureNote: normalizedClosureNote,
    });
    const tracking = await this.tripsRepository.endTripLiveTracking(trip.id);
    const recipientMembershipIds = [
      membership.id,
      ...(await this.tripsRepository.findAcceptedPassengerMembershipIds(trip.id)),
    ];

    await this.auditService.record({
      institutionId: trip.institutionId,
      actorUserId: userId,
      action: AuditAction.TripCompleted,
      entityType: AuditEntityType.Trip,
      entityId: trip.id,
      metadata: {
        status: updatedTrip.status,
        unresolvedPassengerCount: unresolvedParticipants.length,
        forcedClosure: unresolvedParticipants.length > 0,
        closureNote: normalizedClosureNote,
      },
    });

    this.realtimeEventsService.publishTripChanged({
      actorUserId: userId,
      institutionId: trip.institutionId,
      reason: 'completed',
      tripId: trip.id,
    });

    if (tracking) {
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
    }

    return {
      message:
        unresolvedParticipants.length > 0
          ? 'Viaje finalizado con cierre operativo excepcional.'
          : 'Viaje finalizado correctamente.',
      trip: updatedTrip,
    };
  }
}
