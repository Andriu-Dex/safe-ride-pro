import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

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
export class RefreshPaymentStatusUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY)
    private readonly paymentsRepository: PaymentsRepository,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProviderPort,
  ) {}

  async execute(userId: string, paymentId: string) {
    const payment = await this.paymentsRepository.findPaymentById(paymentId);

    if (!payment) {
      throw new NotFoundException('El pago solicitado no existe.');
    }

    if (payment.passengerUserId !== userId && payment.driverUserId !== userId) {
      throw new ForbiddenException('No tienes acceso a este pago.');
    }

    if (!payment.providerOrderToken) {
      return {
        message: 'El pago aun no tiene una orden externa asociada.',
        payment,
      };
    }

    if (!this.paymentProvider.isConfigured()) {
      throw new ServiceUnavailableException(
        'La pasarela PayPal aun no esta configurada en este entorno.',
      );
    }

    const providerState = await this.paymentProvider.fetchPaymentStatus({
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
      throw new NotFoundException('No fue posible sincronizar el pago solicitado.');
    }

    return {
      message: 'Estado de pago sincronizado correctamente.',
      payment: updatedPayment,
    };
  }
}
