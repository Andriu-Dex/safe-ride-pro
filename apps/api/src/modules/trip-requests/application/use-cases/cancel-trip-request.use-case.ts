import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AppNotificationType,
  CancellationTiming,
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import { TripPaymentsOrchestratorService } from '../../../payments/application/services/trip-payments-orchestrator.service';
import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import { OperationalSanctionsService } from '../../../sanctions/application/services/operational-sanctions.service';
import {
  TRIP_REQUESTS_REPOSITORY,
  TripRequestsRepository,
} from '../ports/trip-requests.repository';

@Injectable()
export class CancelTripRequestUseCase {
  constructor(
    @Inject(TRIP_REQUESTS_REPOSITORY)
    private readonly tripRequestsRepository: TripRequestsRepository,
    private readonly operationalSanctionsService: OperationalSanctionsService,
    @Inject(TripPaymentsOrchestratorService)
    private readonly tripPaymentsOrchestratorService: TripPaymentsOrchestratorService,
    @Optional()
    private readonly realtimeEventsService: RealtimeEventsService = new RealtimeEventsService(),
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  async execute(userId: string, requestId: string) {
    const tripRequest = await this.tripRequestsRepository.findTripRequestById(requestId);

    if (!tripRequest) {
      throw new NotFoundException('La solicitud de viaje no existe.');
    }

    if (tripRequest.passengerUserId !== userId) {
      throw new ForbiddenException('Solo el pasajero de la solicitud puede cancelarla.');
    }

    if (
      tripRequest.status !== TripRequestStatus.Pending &&
      tripRequest.status !== TripRequestStatus.Accepted
    ) {
      throw new BadRequestException('Solo las solicitudes pendientes o aceptadas pueden cancelarse.');
    }

    if (
      tripRequest.tripStatus !== TripStatus.Published &&
      tripRequest.tripStatus !== TripStatus.Full
    ) {
      throw new BadRequestException(
        'La solicitud ya no puede cancelarse porque el viaje cambio de estado.',
      );
    }

    await this.tripPaymentsOrchestratorService.cancelTripRequestPayment(
      tripRequest.id,
      'Pago cancelado porque la solicitud fue cancelada por el pasajero.',
    );

    const updatedTripRequest = await this.tripRequestsRepository.cancelTripRequest(requestId);

    if (!updatedTripRequest) {
      throw new BadRequestException(
        'La solicitud ya no pudo cancelarse por un cambio reciente en su estado.',
      );
    }

    if (updatedTripRequest.cancellationTiming === CancellationTiming.Late) {
      await this.operationalSanctionsService.synchronizeAutomaticSanctions(
        updatedTripRequest.passengerMembershipId,
      );
    }

    this.realtimeEventsService.publishTripRequestChanged({
      actorUserId: userId,
      driverMembershipId: updatedTripRequest.driverMembershipId,
      institutionId: updatedTripRequest.institutionId,
      passengerMembershipId: updatedTripRequest.passengerMembershipId,
      reason: 'cancelled',
      requestId: updatedTripRequest.id,
      tripId: updatedTripRequest.tripId,
    });

    await this.notificationsService?.notifyMembership({
      institutionId: updatedTripRequest.institutionId,
      recipientMembershipId: updatedTripRequest.driverMembershipId,
      actorUserId: userId,
      type: AppNotificationType.TripRequestCancelled,
      title: 'Cupo cancelado',
      body: `${updatedTripRequest.passengerFullName} cancelo su solicitud.`,
      actionUrl: '/viajes/aprobar-solicitudes?experienceMode=driver',
    });

    return {
      message: 'Solicitud cancelada correctamente.',
      tripRequest: updatedTripRequest,
    };
  }
}
