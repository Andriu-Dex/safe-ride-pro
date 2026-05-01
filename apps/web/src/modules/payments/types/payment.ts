import {
  PaymentProvider,
  TripPaymentStatus,
} from '@saferidepro/shared-types';

export type TripPaymentRecord = {
  id: string;
  provider: PaymentProvider;
  status: TripPaymentStatus;
  currencyCode: string;
  amount: number;
  checkoutUrl: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
};
