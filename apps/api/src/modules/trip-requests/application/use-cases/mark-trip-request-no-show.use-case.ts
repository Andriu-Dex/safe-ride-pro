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

import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import { OperationalSanctionsService } from '../../../sanctions/application/services/operational-sanctions.service';
import {
  TRIP_REQUESTS_REPOSITORY,
  TripRequestsRepository,
} from '../ports/trip-requests.repository';

@Injectable()
export class MarkTripRequestNoShowUseCase {
  constructor(
    @Inject(TRIP_REQUESTS_REPOSITORY)
    private readonly tripRequestsRepository: TripRequestsRepository,
    private readonly operationalSanctionsService: OperationalSanctionsService,
    @Optional()
    private readonly realtimeEventsService: RealtimeEventsService = new RealtimeEventsService(),
  ) {}

  async execute(userId: string, requestId: string, reviewNote?: string) {
    const tripRequest = await this.tripRequestsRepository.findTripRequestById(requestId);

    if (!tripRequest) {
      throw new NotFoundException('La solicitud de viaje no existe.');
    }

    if (tripRequest.driverUserId !== userId) {
      throw new ForbiddenException('Solo el conductor del viaje puede registrar un no-show.');
    }

    if (tripRequest.status !== TripRequestStatus.Accepted) {
      throw new BadRequestException(
        'Solo las solicitudes aceptadas pueden marcarse como no-show.',
      );
    }

    if (
      tripRequest.tripStatus !== TripStatus.InProgress &&
      tripRequest.tripStatus !== TripStatus.Completed
    ) {
      throw new BadRequestException(
        'Solo puedes marcar no-show cuando el viaje ya inicio o finalizo.',
      );
    }

    const normalizedReviewNote = reviewNote?.trim();

    if (!normalizedReviewNote) {
      throw new BadRequestException('Debes indicar una nota para registrar el no-show.');
    }

    if (
      tripRequest.executionStatus === TripRequestExecutionStatus.OnBoard ||
      tripRequest.executionStatus === TripRequestExecutionStatus.DroppedOff
    ) {
      throw new BadRequestException(
        'No puedes registrar no-show para un pasajero que ya fue abordado o finalizado.',
      );
    }

    const updatedTripRequest = await this.tripRequestsRepository.markTripRequestAsNoShow(
      requestId,
      normalizedReviewNote,
    );

    if (!updatedTripRequest) {
      throw new BadRequestException(
        'La solicitud ya no pudo marcarse como no-show por un cambio reciente en su estado.',
      );
    }

    await this.operationalSanctionsService.synchronizeAutomaticSanctions(
      updatedTripRequest.passengerMembershipId,
    );

    this.realtimeEventsService.publishTripRequestChanged({
      actorUserId: userId,
      driverMembershipId: updatedTripRequest.driverMembershipId,
      institutionId: updatedTripRequest.institutionId,
      passengerMembershipId: updatedTripRequest.passengerMembershipId,
      reason: 'no_show',
      requestId: updatedTripRequest.id,
      tripId: updatedTripRequest.tripId,
    });

    return {
      message: 'No-show registrado correctamente.',
      tripRequest: updatedTripRequest,
    };
  }
}
