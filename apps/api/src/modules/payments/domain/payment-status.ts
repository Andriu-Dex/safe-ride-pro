import { TripPaymentStatus } from '@saferidepro/shared-types';

export function mapPaypalStatusesToTripPaymentStatus(input: {
  orderStatus?: string | null;
  paymentStatus?: string | null;
}): TripPaymentStatus {
  const orderStatus = input.orderStatus?.trim().toUpperCase() ?? '';
  const paymentStatus = input.paymentStatus?.trim().toUpperCase() ?? '';

  if (paymentStatus === 'COMPLETED') {
    return TripPaymentStatus.Paid;
  }

  if (
    orderStatus === 'APPROVED'
    || orderStatus === 'PAYER_ACTION_REQUIRED'
    || orderStatus === 'SAVED'
    || orderStatus === 'PROCESSING'
    || paymentStatus === 'PENDING'
  ) {
    return TripPaymentStatus.Processing;
  }

  if (orderStatus === 'CREATED') {
    return TripPaymentStatus.CheckoutReady;
  }

  if (
    orderStatus === 'VOIDED'
    || paymentStatus === 'DECLINED'
    || paymentStatus === 'DENIED'
    || paymentStatus === 'FAILED'
  ) {
    return TripPaymentStatus.Failed;
  }

  if (paymentStatus === 'REFUNDED') {
    return TripPaymentStatus.Refunded;
  }

  return TripPaymentStatus.CheckoutReady;
}
