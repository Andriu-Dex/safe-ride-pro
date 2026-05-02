import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentProvider, TripPaymentStatus } from '@saferidepro/shared-types';

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
export class CreatePaymentCheckoutLinkUseCase {
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

    if (payment.passengerUserId !== userId) {
      throw new ForbiddenException('Solo el pasajero asociado puede iniciar este pago.');
    }

    if (payment.provider !== PaymentProvider.Paypal) {
      throw new BadRequestException('Este pago no corresponde a PayPal.');
    }

    if (payment.status === TripPaymentStatus.Paid) {
      throw new BadRequestException('Este pago ya fue completado.');
    }

    if (
      payment.status === TripPaymentStatus.Cancelled
      || payment.status === TripPaymentStatus.Expired
    ) {
      throw new BadRequestException('Este pago ya no se encuentra disponible.');
    }

    if (!this.paymentProvider.isConfigured()) {
      throw new ServiceUnavailableException(
        'La pasarela PayPal aun no esta configurada en este entorno.',
      );
    }

    const checkout = await this.paymentProvider.createCheckout({
      paymentId: payment.id,
      merchantOrderReference: payment.merchantOrderReference,
      amount: payment.amount,
      currencyCode: payment.currencyCode,
      passengerEmail: payment.passengerEmail,
      passengerFullName: payment.passengerFullName,
      tripOriginLabel: payment.tripOriginLabel,
      tripDestinationLabel: payment.tripDestinationLabel,
      tripDepartureAt: payment.tripDepartureAt,
    });

    const nextStatus = mapPaypalStatusesToTripPaymentStatus({
      orderStatus: checkout.providerOrderStatus,
      paymentStatus: checkout.providerPaymentStatus,
    });

    const updatedPayment = await this.paymentsRepository.recordCheckout({
      paymentId: payment.id,
      status:
        nextStatus === TripPaymentStatus.Paid
          ? TripPaymentStatus.Paid
          : TripPaymentStatus.CheckoutReady,
      checkoutUrl: checkout.checkoutUrl,
      providerOrderToken: checkout.providerOrderToken,
      providerPaymentLinkId: checkout.providerPaymentLinkId,
      providerOrderStatus: checkout.providerOrderStatus,
      providerPaymentStatus: checkout.providerPaymentStatus,
      expiresAt: checkout.expiresAt,
      requestPayload: {
        merchantOrderReference: payment.merchantOrderReference,
      },
      responsePayload: checkout.rawResponse,
    });

    return {
      message: 'Enlace de pago generado correctamente.',
      payment: updatedPayment,
      checkoutUrl: checkout.checkoutUrl,
    };
  }
}
