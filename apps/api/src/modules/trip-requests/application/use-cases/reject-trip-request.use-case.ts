import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { TripRequestStatus, TripStatus } from '@saferidepro/shared-types';

import { TripPaymentsOrchestratorService } from '../../../payments/application/services/trip-payments-orchestrator.service';
import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import {
  TRIP_REQUESTS_REPOSITORY,
  TripRequestsRepository,
} from '../ports/trip-requests.repository';

@Injectable()
export class RejectTripRequestUseCase {
  constructor(
    @Inject(TRIP_REQUESTS_REPOSITORY)
    private readonly tripRequestsRepository: TripRequestsRepository,
    @Optional()
    private readonly tripPaymentsOrchestratorService: Pick<
      TripPaymentsOrchestratorService,
      'cancelTripRequestPayment'
    > = {
      cancelTripRequestPayment: async () => null,
    },
    @Optional()
    private readonly realtimeEventsService: RealtimeEventsService = new RealtimeEventsService(),
  ) {}

  async execute(userId: string, requestId: string, reviewNote?: string) {
    const tripRequest = await this.tripRequestsRepository.findTripRequestById(requestId);

    if (!tripRequest) {
      throw new NotFoundException('La solicitud de viaje no existe.');
    }

    if (tripRequest.driverUserId !== userId) {
      throw new ForbiddenException('Solo el conductor del viaje puede rechazar esta solicitud.');
    }

    if (tripRequest.status !== TripRequestStatus.Pending) {
      throw new BadRequestException('Solo las solicitudes pendientes pueden rechazarse.');
    }

    if (
      tripRequest.tripStatus !== TripStatus.Published &&
      tripRequest.tripStatus !== TripStatus.Full
    ) {
      throw new BadRequestException(
        'La solicitud ya no puede rechazarse porque el viaje cambio de estado.',
      );
    }

    await this.tripPaymentsOrchestratorService.cancelTripRequestPayment(
      tripRequest.id,
      'Pago reembolsado porque la solicitud fue rechazada por el conductor.',
    );

    const updatedTripRequest = await this.tripRequestsRepository.rejectTripRequest(
      requestId,
      reviewNote?.trim() || undefined,
    );

    if (!updatedTripRequest) {
      throw new BadRequestException(
        'La solicitud ya no pudo rechazarse por un cambio reciente en su estado.',
      );
    }

    this.realtimeEventsService.publishTripRequestChanged({
      actorUserId: userId,
      driverMembershipId: updatedTripRequest.driverMembershipId,
      institutionId: updatedTripRequest.institutionId,
      passengerMembershipId: updatedTripRequest.passengerMembershipId,
      reason: 'rejected',
      requestId: updatedTripRequest.id,
      tripId: updatedTripRequest.tripId,
    });

    return {
      message: 'Solicitud rechazada correctamente.',
      tripRequest: updatedTripRequest,
    };
  }
}
