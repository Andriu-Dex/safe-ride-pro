import { Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { PaymentProvider, TripPaymentStatus } from '@saferidepro/shared-types';

import {
  PAYMENT_PROVIDER,
  PaymentProviderPort,
} from '../ports/payment-provider';

import {
  PAYMENTS_REPOSITORY,
  TripPaymentRecord,
  PaymentsRepository,
} from '../ports/payments.repository';

@Injectable()
export class TripPaymentsOrchestratorService {
  constructor(
    @Inject(PAYMENTS_REPOSITORY)
    private readonly paymentsRepository: PaymentsRepository,
    @Optional()
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider?: PaymentProviderPort,
  ) {}

  async ensureAcceptedTripRequestPayment(tripRequestId: string, currencyCode: string) {
    const payment = await this.paymentsRepository.upsertAcceptedTripRequestPayment({
      tripRequestId,
      currencyCode,
    });

    if (
      payment?.provider === PaymentProvider.Wallet &&
      payment.status === TripPaymentStatus.Paid
    ) {
      return this.paymentsRepository.captureWalletPayment(payment.id);
    }

    return payment;
  }

  async cancelTripRequestPayment(tripRequestId: string, failureReason: string) {
    const payment = await this.paymentsRepository.findPaymentByTripRequestId(tripRequestId);

    if (!payment) {
      return null;
    }

    return this.closePayment(payment, failureReason);
  }

  async cancelTripPayments(tripId: string, failureReason: string) {
    const payments = await this.paymentsRepository.listPaymentsByTripId(tripId);
    const closedPayments = await Promise.all(
      payments.map((payment) => this.closePayment(payment, failureReason)),
    );

    return closedPayments.filter(Boolean).length;
  }

  private async closePayment(payment: TripPaymentRecord, failureReason: string) {
    if (
      payment.status === TripPaymentStatus.Cancelled ||
      payment.status === TripPaymentStatus.Refunded ||
      payment.status === TripPaymentStatus.Expired
    ) {
      return payment;
    }

    if (
      payment.provider === PaymentProvider.Paypal &&
      payment.status === TripPaymentStatus.Paid
    ) {
      if (!this.paymentProvider?.isConfigured()) {
        throw new ServiceUnavailableException(
          'No fue posible reembolsar el pago PayPal en este entorno.',
        );
      }

      const refund = await this.paymentProvider.refundPayment({
        providerOrderToken: payment.providerOrderToken,
        providerCaptureId: payment.providerPaymentLinkId,
      });

      return this.paymentsRepository.markPaymentRefunded({
        paymentId: payment.id,
        failureReason,
        providerPaymentLinkId: refund.providerCaptureId,
        providerOrderStatus: refund.providerOrderStatus,
        providerPaymentStatus: refund.providerPaymentStatus,
        refundedAt: refund.refundedAt,
        responsePayload: refund.rawResponse,
      });
    }

    if (
      payment.provider === PaymentProvider.Wallet &&
      payment.status === TripPaymentStatus.Paid
    ) {
      return this.paymentsRepository.refundWalletPayment(payment.id, failureReason);
    }

    if (payment.status === TripPaymentStatus.Paid) {
      return payment;
    }

    return this.paymentsRepository.markPaymentCancelledByTripRequestId(
      payment.tripRequestId,
      failureReason,
    );
  }
}
