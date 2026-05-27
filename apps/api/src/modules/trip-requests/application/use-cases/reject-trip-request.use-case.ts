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

import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import type { TripPaymentRecord } from '../../../payments/application/ports/payments.repository';
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

    const closedPayment = await this.tripPaymentsOrchestratorService.cancelTripRequestPayment(
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

    await this.notificationsService?.notifyMembership({
      institutionId: updatedTripRequest.institutionId,
      recipientMembershipId: updatedTripRequest.passengerMembershipId,
      actorUserId: userId,
      type: AppNotificationType.TripRequestRejected,
      title: 'Solicitud rechazada',
      body: buildRejectedRequestNotificationBody(closedPayment),
      actionUrl: '/viajes?passengerView=requests',
    });

    return {
      message:
        closedPayment?.status === TripPaymentStatus.Refunded
          ? 'Solicitud rechazada y pago reembolsado.'
          : 'Solicitud rechazada correctamente.',
      tripRequest: updatedTripRequest,
    };
  }
}

function buildRejectedRequestNotificationBody(payment: TripPaymentRecord | null): string {
  if (payment?.status !== TripPaymentStatus.Refunded) {
    return 'El conductor rechazo tu solicitud.';
  }

  if (payment.provider === PaymentProvider.Paypal) {
    return 'El conductor rechazo tu solicitud y el pago fue reembolsado por PayPal.';
  }

  if (payment.provider === PaymentProvider.Wallet) {
    return 'El conductor rechazo tu solicitud y el saldo volvio a tu billetera.';
  }

  return 'El conductor rechazo tu solicitud.';
}
