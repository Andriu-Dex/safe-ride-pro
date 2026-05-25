import { PaymentProvider } from '@saferidepro/shared-types';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export type CreatePaymentCheckoutInput = {
  paymentId: string;
  merchantOrderReference: string;
  amount: number;
  currencyCode: string;
  passengerEmail: string;
  passengerFullName: string;
  tripOriginLabel: string;
  tripDestinationLabel: string;
  tripDepartureAt: Date;
  description?: string;
  successPath?: string;
  cancelPath?: string;
  successParams?: Record<string, string>;
  cancelParams?: Record<string, string>;
};

export type CreatePaymentCheckoutResult = {
  provider: PaymentProvider;
  checkoutUrl: string;
  providerOrderToken: string | null;
  providerPaymentLinkId: string | null;
  providerOrderStatus: string | null;
  providerPaymentStatus: string | null;
  expiresAt: Date | null;
  rawResponse: unknown;
};

export type FetchPaymentStatusInput = {
  providerOrderToken: string;
};

export type FetchPaymentStatusResult = {
  provider: PaymentProvider;
  providerOrderToken: string;
  providerCaptureId: string | null;
  providerOrderStatus: string | null;
  providerPaymentStatus: string | null;
  paidAt: Date | null;
  expiresAt: Date | null;
  rawResponse: unknown;
};

export type CapturePaymentInput = {
  providerOrderToken: string;
};

export type CapturePaymentResult = {
  provider: PaymentProvider;
  providerOrderToken: string;
  providerCaptureId: string | null;
  providerOrderStatus: string | null;
  providerPaymentStatus: string | null;
  paidAt: Date | null;
  expiresAt: Date | null;
  rawResponse: unknown;
};

export type RefundPaymentInput = {
  providerOrderToken: string | null;
  providerCaptureId: string | null;
};

export type RefundPaymentResult = {
  provider: PaymentProvider;
  providerOrderToken: string | null;
  providerCaptureId: string;
  providerOrderStatus: string | null;
  providerPaymentStatus: string | null;
  refundedAt: Date | null;
  rawResponse: unknown;
};

export interface PaymentProviderPort {
  readonly name: PaymentProvider;
  isConfigured(): boolean;
  createCheckout(input: CreatePaymentCheckoutInput): Promise<CreatePaymentCheckoutResult>;
  fetchPaymentStatus(input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult>;
  capturePayment(input: CapturePaymentInput): Promise<CapturePaymentResult>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
}
