import {
  PaymentProvider,
  TripPaymentStatus,
} from '@saferidepro/shared-types';
import { describe, expect, it } from 'vitest';

import {
  formatTripPaymentAmount,
  getPaymentProviderLabel,
  getTripPaymentStatusLabel,
  getTripPaymentStatusTone,
} from './payment-labels';

describe('payment labels', () => {
  it('resolves readable labels and tones', () => {
    expect(getTripPaymentStatusLabel(TripPaymentStatus.CheckoutReady)).toBe('Listo para pagar');
    expect(getTripPaymentStatusTone(TripPaymentStatus.CheckoutReady)).toBe('warning');
    expect(getTripPaymentStatusLabel(TripPaymentStatus.Paid)).toBe('Pagado');
    expect(getTripPaymentStatusTone(TripPaymentStatus.Paid)).toBe('success');
  });

  it('formats provider and amount for es-EC', () => {
    expect(getPaymentProviderLabel(PaymentProvider.Paypal)).toBe('PayPal');
    expect(getPaymentProviderLabel(PaymentProvider.Wallet)).toBe('Billetera');
    expect(formatTripPaymentAmount(2.5, 'USD')).toContain('2,50');
  });
});
