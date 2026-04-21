import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import {
  TRIP_REQUESTS_REPOSITORY,
  TripRequestsRepository,
} from '../ports/trip-requests.repository';

@Injectable()
export class MarkTripRequestBoardedUseCase {
  constructor(
    @Inject(TRIP_REQUESTS_REPOSITORY)
    private readonly tripRequestsRepository: TripRequestsRepository,
    private readonly auditService: AuditService,
    @Optional()
    private readonly realtimeEventsService: RealtimeEventsService = new RealtimeEventsService(),
  ) {}

  async execute(userId: string, requestId: string) {
    const tripRequest = await this.tripRequestsRepository.findTripRequestById(requestId);

    if (!tripRequest) {
      throw new NotFoundException('La solicitud de viaje no existe.');
    }

    if (tripRequest.driverUserId !== userId) {
      throw new ForbiddenException('Solo el conductor del viaje puede marcar el abordaje.');
    }

    if (tripRequest.status !== TripRequestStatus.Accepted) {
      throw new BadRequestException('Solo las solicitudes aceptadas pueden marcarse como abordadas.');
    }

    if (tripRequest.tripStatus !== TripStatus.InProgress) {
      throw new BadRequestException('Solo puedes marcar abordaje cuando el viaje esta en curso.');
    }

    if (
      tripRequest.executionStatus !== null &&
      tripRequest.executionStatus !== TripRequestExecutionStatus.AcceptedPendingBoarding
    ) {
      throw new BadRequestException(
        'Solo puedes marcar abordaje para pasajeros pendientes de subir.',
      );
    }

    const updatedTripRequest = await this.tripRequestsRepository.markTripRequestBoarded(requestId);

    if (!updatedTripRequest) {
      throw new BadRequestException(
        'No se pudo registrar el abordaje por un cambio reciente en el estado del pasajero.',
      );
    }

    await this.auditService.record({
      institutionId: updatedTripRequest.institutionId,
      actorUserId: userId,
      action: AuditAction.TripPassengerBoarded,
      entityType: AuditEntityType.Trip,
      entityId: updatedTripRequest.tripId,
      metadata: {
        requestId: updatedTripRequest.id,
        passengerMembershipId: updatedTripRequest.passengerMembershipId,
        executionStatus: updatedTripRequest.executionStatus,
      },
    });

    this.realtimeEventsService.publishTripRequestChanged({
      actorUserId: userId,
      driverMembershipId: updatedTripRequest.driverMembershipId,
      institutionId: updatedTripRequest.institutionId,
      passengerMembershipId: updatedTripRequest.passengerMembershipId,
      reason: 'boarded',
      requestId: updatedTripRequest.id,
      tripId: updatedTripRequest.tripId,
    });

    return {
      message: 'Pasajero marcado como abordado.',
      tripRequest: updatedTripRequest,
    };
  }
}
