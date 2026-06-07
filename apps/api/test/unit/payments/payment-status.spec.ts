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

  it('marks refunded orders as refunded', () => {
    expect(
      mapPaypalStatusesToTripPaymentStatus({
        orderStatus: '',
        paymentStatus: 'REFUNDED',
      }),
    ).toBe(TripPaymentStatus.Refunded);
  });

  it('defaults unknown status patterns to checkout ready', () => {
    expect(
      mapPaypalStatusesToTripPaymentStatus({
        orderStatus: 'SOME_RANDOM_STATUS',
        paymentStatus: 'OTHER_RANDOM_STATUS',
      }),
    ).toBe(TripPaymentStatus.CheckoutReady);
  });

  it('handles null/undefined inputs safely', () => {
    expect(
      mapPaypalStatusesToTripPaymentStatus({}),
    ).toBe(TripPaymentStatus.CheckoutReady);
    expect(
      mapPaypalStatusesToTripPaymentStatus({
        orderStatus: null,
        paymentStatus: null,
      }),
    ).toBe(TripPaymentStatus.CheckoutReady);
  });
});
