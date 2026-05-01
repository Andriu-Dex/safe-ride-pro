import { TripPaymentStatus } from '@saferidepro/shared-types';

import { mapPaypalStatusesToTripPaymentStatus } from '../../../src/modules/payments/domain/payment-status';

describe('mapPaypalStatusesToTripPaymentStatus', () => {
  it('marks completed orders as paid', () => {
    expect(
      mapPaypalStatusesToTripPaymentStatus({
        orderStatus: 'COMPLETED',
        paymentStatus: 'COMPLETED',
      }),
    ).toBe(TripPaymentStatus.Paid);
  });

  it('marks processing states as processing', () => {
    expect(
      mapPaypalStatusesToTripPaymentStatus({
        orderStatus: 'APPROVED',
        paymentStatus: 'PENDING',
      }),
    ).toBe(TripPaymentStatus.Processing);
  });

  it('marks failed states as failed', () => {
    expect(
      mapPaypalStatusesToTripPaymentStatus({
        orderStatus: 'VOIDED',
        paymentStatus: 'FAILED',
      }),
    ).toBe(TripPaymentStatus.Failed);
  });

  it('defaults unknown initial responses to checkout ready', () => {
    expect(
      mapPaypalStatusesToTripPaymentStatus({
        orderStatus: 'CREATED',
        paymentStatus: '',
      }),
    ).toBe(TripPaymentStatus.CheckoutReady);
  });
});
