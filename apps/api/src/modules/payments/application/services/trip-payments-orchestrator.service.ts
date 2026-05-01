import { Inject, Injectable } from '@nestjs/common';

import {
  PAYMENTS_REPOSITORY,
  PaymentsRepository,
} from '../ports/payments.repository';

@Injectable()
export class TripPaymentsOrchestratorService {
  constructor(
    @Inject(PAYMENTS_REPOSITORY)
    private readonly paymentsRepository: PaymentsRepository,
  ) {}

  async ensureAcceptedTripRequestPayment(tripRequestId: string, currencyCode: string) {
    return this.paymentsRepository.upsertAcceptedTripRequestPayment({
      tripRequestId,
      currencyCode,
    });
  }

  async cancelTripRequestPayment(tripRequestId: string, failureReason: string) {
    return this.paymentsRepository.markPaymentCancelledByTripRequestId(
      tripRequestId,
      failureReason,
    );
  }

  async cancelTripPayments(tripId: string, failureReason: string) {
    return this.paymentsRepository.markPaymentsCancelledByTripId(tripId, failureReason);
  }
}
