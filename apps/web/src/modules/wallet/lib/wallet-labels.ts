export function formatWalletAmount(amount: number, currencyCode = 'USD'): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function getWalletMovementLabel(type: string): string {
  switch (type) {
    case 'TOP_UP_CAPTURED':
      return 'Recarga';
    case 'HOLD_CREATED':
      return 'Retencion';
    case 'HOLD_RELEASED':
      return 'Liberacion';
    case 'HOLD_CAPTURED':
      return 'Pago';
    case 'REFUND_CREDIT':
      return 'Devolucion';
    default:
      return 'Movimiento';
  }
}

export function getWalletTopUpStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Pendiente';
    case 'CHECKOUT_READY':
      return 'Listo';
    case 'PROCESSING':
      return 'Procesando';
    case 'PAID':
      return 'Acreditado';
    case 'FAILED':
      return 'Fallido';
    case 'CANCELLED':
      return 'Cancelado';
    case 'EXPIRED':
      return 'Expirado';
    default:
      return status;
  }
}
