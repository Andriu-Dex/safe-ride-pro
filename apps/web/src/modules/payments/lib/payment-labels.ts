import {
  PaymentProvider,
  TripPaymentStatus,
} from '@saferidepro/shared-types';

export function getTripPaymentStatusLabel(status: TripPaymentStatus): string {
  switch (status) {
    case TripPaymentStatus.Pending:
      return 'Pendiente';
    case TripPaymentStatus.CheckoutReady:
      return 'Listo para pagar';
    case TripPaymentStatus.Processing:
      return 'En verificacion';
    case TripPaymentStatus.Paid:
      return 'Pagado';
    case TripPaymentStatus.Failed:
      return 'Pago fallido';
    case TripPaymentStatus.Expired:
      return 'Expirado';
    case TripPaymentStatus.Cancelled:
      return 'Cancelado';
    case TripPaymentStatus.Refunded:
      return 'Reembolsado';
    default:
      return 'Sin estado';
  }
}

export function getTripPaymentStatusTone(
  status: TripPaymentStatus,
): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case TripPaymentStatus.Paid:
    case TripPaymentStatus.Refunded:
      return 'success';
    case TripPaymentStatus.CheckoutReady:
    case TripPaymentStatus.Processing:
      return 'warning';
    case TripPaymentStatus.Failed:
    case TripPaymentStatus.Expired:
    case TripPaymentStatus.Cancelled:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getPaymentProviderLabel(provider: PaymentProvider): string {
  switch (provider) {
    case PaymentProvider.Paypal:
      return 'PayPal';
    case PaymentProvider.Cash:
      return 'Efectivo';
    case PaymentProvider.Wallet:
      return 'Billetera';
    default:
      return provider;
  }
}

export function formatTripPaymentAmount(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount);
}
