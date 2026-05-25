import { describe, expect, it } from 'vitest';

import {
  formatWalletAmount,
  getWalletMovementLabel,
  getWalletTopUpStatusLabel,
} from './wallet-labels';

describe('wallet labels', () => {
  it('formats wallet amounts and operational labels', () => {
    expect(formatWalletAmount(12.5, 'USD')).toContain('12,50');
    expect(getWalletMovementLabel('HOLD_CREATED')).toBe('Retencion');
    expect(getWalletMovementLabel('HOLD_CAPTURED')).toBe('Pago');
    expect(getWalletTopUpStatusLabel('PAID')).toBe('Acreditado');
  });
});
