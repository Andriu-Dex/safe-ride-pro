import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppNotificationType, TripPaymentStatus } from '@saferidepro/shared-types';

import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import { mapPaypalStatusesToTripPaymentStatus } from '../../domain/payment-status';
import {
  PAYMENT_PROVIDER,
  PaymentProviderPort,
} from '../ports/payment-provider';
import {
  PAYMENTS_REPOSITORY,
  PaymentsRepository,
} from '../ports/payments.repository';

@Injectable()
export class CapturePaymentUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY)
    private readonly paymentsRepository: PaymentsRepository,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProviderPort,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  async execute(userId: string, paymentId: string) {
    const payment = await this.paymentsRepository.findPaymentById(paymentId);

    if (!payment) {
      throw new NotFoundException('El pago solicitado no existe.');
    }

    if (payment.passengerUserId !== userId) {
      throw new ForbiddenException('Solo el pasajero asociado puede capturar este pago.');
    }

    if (!payment.providerOrderToken) {
      throw new NotFoundException('El pago aun no tiene una orden PayPal asociada.');
    }

    if (payment.status === TripPaymentStatus.Paid) {
      return {
        message: 'El pago ya estaba confirmado.',
        payment,
      };
    }

    if (!this.paymentProvider.isConfigured()) {
      throw new ServiceUnavailableException(
        'La pasarela PayPal aun no esta configurada en este entorno.',
      );
    }

    const providerState = await this.paymentProvider.capturePayment({
      providerOrderToken: payment.providerOrderToken,
    });

    const updatedPayment = await this.paymentsRepository.syncPaymentStatus({
      paymentId: payment.id,
      status: mapPaypalStatusesToTripPaymentStatus({
        orderStatus: providerState.providerOrderStatus,
        paymentStatus: providerState.providerPaymentStatus,
      }),
      providerPaymentLinkId: providerState.providerCaptureId,
      providerOrderStatus: providerState.providerOrderStatus,
      providerPaymentStatus: providerState.providerPaymentStatus,
      paidAt: providerState.paidAt,
      expiresAt: providerState.expiresAt,
      responsePayload: providerState.rawResponse,
    });

    if (!updatedPayment) {
      throw new NotFoundException('No fue posible confirmar el pago solicitado.');
    }

    if (updatedPayment.status === TripPaymentStatus.Paid) {
      await this.notificationsService?.notifyMembership({
        institutionId: updatedPayment.institutionId,
        recipientMembershipId: updatedPayment.driverMembershipId,
        actorUserId: userId,
        type: AppNotificationType.TripRequestCreated,
        title: 'Solicitud pagada',
        body: `${updatedPayment.passengerFullName} pago por PayPal y espera tu respuesta.`,
        actionUrl: '/viajes/aprobar-solicitudes?experienceMode=driver',
      });
    }

    return {
      message: 'Pago confirmado correctamente.',
      payment: updatedPayment,
    };
  }
}
