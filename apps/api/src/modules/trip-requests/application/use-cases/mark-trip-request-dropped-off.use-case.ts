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
export class MarkTripRequestDroppedOffUseCase {
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
      throw new ForbiddenException('Solo el conductor del viaje puede marcar el cierre del pasajero.');
    }

    if (tripRequest.status !== TripRequestStatus.Accepted) {
      throw new BadRequestException('Solo las solicitudes aceptadas pueden cerrarse operativamente.');
    }

    if (tripRequest.tripStatus !== TripStatus.InProgress) {
      throw new BadRequestException('Solo puedes cerrar pasajeros cuando el viaje esta en curso.');
    }

    if (tripRequest.executionStatus !== TripRequestExecutionStatus.OnBoard) {
      throw new BadRequestException(
        'Solo puedes marcar finalizacion para pasajeros que ya fueron abordados.',
      );
    }

    const updatedTripRequest = await this.tripRequestsRepository.markTripRequestDroppedOff(
      requestId,
    );

    if (!updatedTripRequest) {
      throw new BadRequestException(
        'No se pudo registrar la finalizacion del pasajero por un cambio reciente en su estado.',
      );
    }

    await this.auditService.record({
      institutionId: updatedTripRequest.institutionId,
      actorUserId: userId,
      action: AuditAction.TripPassengerDroppedOff,
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
      reason: 'dropped_off',
      requestId: updatedTripRequest.id,
      tripId: updatedTripRequest.tripId,
    });

    return {
      message: 'Pasajero marcado como finalizado.',
      tripRequest: updatedTripRequest,
    };
  }
}
