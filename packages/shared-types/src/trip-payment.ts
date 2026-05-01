export enum PaymentProvider {
  Paypal = 'PAYPAL',
}

export enum TripPaymentStatus {
  Pending = 'PENDING',
  CheckoutReady = 'CHECKOUT_READY',
  Processing = 'PROCESSING',
  Paid = 'PAID',
  Failed = 'FAILED',
  Expired = 'EXPIRED',
  Cancelled = 'CANCELLED',
  Refunded = 'REFUNDED',
}

export function isTripPaymentSettled(status: TripPaymentStatus): boolean {
  return status === TripPaymentStatus.Paid || status === TripPaymentStatus.Refunded;
}

export function isTripPaymentClosed(status: TripPaymentStatus): boolean {
  return (
    status === TripPaymentStatus.Paid
    || status === TripPaymentStatus.Refunded
    || status === TripPaymentStatus.Cancelled
    || status === TripPaymentStatus.Expired
  );
}
