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
  PaymentProvider,
  TripPaymentStatus,
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { getAppEnvironment } from '../../../../shared/infrastructure/config/app-environment';
import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import { TripPaymentsOrchestratorService } from '../../../payments/application/services/trip-payments-orchestrator.service';
import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import {
  TRIP_REQUESTS_REPOSITORY,
  TripRequestsRepository,
} from '../ports/trip-requests.repository';

@Injectable()
export class AcceptTripRequestUseCase {
  constructor(
    @Inject(TRIP_REQUESTS_REPOSITORY)
    private readonly tripRequestsRepository: TripRequestsRepository,
    @Inject(TripPaymentsOrchestratorService)
    private readonly tripPaymentsOrchestratorService: TripPaymentsOrchestratorService,
    @Optional()
    private readonly realtimeEventsService: RealtimeEventsService = new RealtimeEventsService(),
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  async execute(userId: string, requestId: string, reviewNote?: string) {
    const tripRequest = await this.tripRequestsRepository.findTripRequestById(requestId);

    if (!tripRequest) {
      throw new NotFoundException('La solicitud de viaje no existe.');
    }

    if (tripRequest.driverUserId !== userId) {
      throw new ForbiddenException('Solo el conductor del viaje puede aceptar esta solicitud.');
    }

    if (tripRequest.status !== TripRequestStatus.Pending) {
      throw new BadRequestException('Solo las solicitudes pendientes pueden aceptarse.');
    }

    if (tripRequest.tripStatus !== TripStatus.Published) {
      throw new BadRequestException(
        'La solicitud ya no puede aceptarse porque el viaje cambio de estado.',
      );
    }

    if (tripRequest.tripAvailableSeats < 1) {
      throw new BadRequestException('El viaje ya no tiene cupos disponibles.');
    }

    if (
      tripRequest.payment?.provider === PaymentProvider.Paypal &&
      tripRequest.payment.status !== TripPaymentStatus.Paid
    ) {
      throw new BadRequestException(
        'Esta solicitud todavia no tiene el pago PayPal confirmado.',
      );
    }

    const updatedTripRequest = await this.tripRequestsRepository.acceptTripRequest(
      requestId,
      reviewNote?.trim() || undefined,
    );

    if (!updatedTripRequest) {
      throw new BadRequestException(
        'La solicitud ya no pudo aceptarse porque el viaje cambio de estado.',
      );
    }

    await this.tripPaymentsOrchestratorService.ensureAcceptedTripRequestPayment(
      updatedTripRequest.id,
      getAppEnvironment().paymentsCurrency,
    );

    this.realtimeEventsService.publishTripRequestChanged({
      actorUserId: userId,
      driverMembershipId: updatedTripRequest.driverMembershipId,
      institutionId: updatedTripRequest.institutionId,
      passengerMembershipId: updatedTripRequest.passengerMembershipId,
      reason: 'accepted',
      requestId: updatedTripRequest.id,
      tripId: updatedTripRequest.tripId,
    });

    await this.notificationsService?.notifyMembership({
      institutionId: updatedTripRequest.institutionId,
      recipientMembershipId: updatedTripRequest.passengerMembershipId,
      actorUserId: userId,
      type: AppNotificationType.TripRequestAccepted,
      title: 'Solicitud aceptada',
      body: `${updatedTripRequest.driverFullName} acepto tu viaje.`,
      actionUrl: '/viajes?passengerView=requests',
    });

    return {
      message: 'Solicitud aceptada correctamente.',
      tripRequest: updatedTripRequest,
    };
  }
}
