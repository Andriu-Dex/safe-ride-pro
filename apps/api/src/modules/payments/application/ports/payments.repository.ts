import {
  PaymentProvider,
  TripPaymentStatus,
} from '@saferidepro/shared-types';

export const PAYMENTS_REPOSITORY = Symbol('PAYMENTS_REPOSITORY');

export type TripPaymentRecord = {
  id: string;
  institutionId: string;
  tripId: string;
  tripRequestId: string;
  passengerMembershipId: string;
  passengerUserId: string;
  passengerEmail: string;
  passengerFullName: string;
  driverMembershipId: string;
  driverUserId: string;
  driverFullName: string;
  tripOriginLabel: string;
  tripDestinationLabel: string;
  tripDepartureAt: Date;
  tripStatus: string;
  provider: PaymentProvider;
  status: TripPaymentStatus;
  currencyCode: string;
  amount: number;
  merchantOrderReference: string;
  providerOrderToken: string | null;
  providerPaymentLinkId: string | null;
  providerPaymentLinkUrl: string | null;
  providerOrderStatus: string | null;
  providerPaymentStatus: string | null;
  failureReason: string | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  expiresAt: Date | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertAcceptedTripRequestPaymentInput = {
  tripRequestId: string;
  currencyCode: string;
};

export type RecordPaymentCheckoutInput = {
  paymentId: string;
  status: TripPaymentStatus;
  checkoutUrl: string;
  providerOrderToken: string | null;
  providerPaymentLinkId: string | null;
  providerOrderStatus: string | null;
  providerPaymentStatus: string | null;
  expiresAt: Date | null;
  requestPayload: unknown;
  responsePayload: unknown;
};

export type SyncPaymentStatusInput = {
  paymentId: string;
  status: TripPaymentStatus;
  providerPaymentLinkId?: string | null;
  providerOrderStatus: string | null;
  providerPaymentStatus: string | null;
  paidAt: Date | null;
  expiresAt: Date | null;
  responsePayload: unknown;
};

export type MarkPaymentRefundedInput = {
  paymentId: string;
  failureReason?: string;
  providerPaymentLinkId?: string | null;
  providerOrderStatus?: string | null;
  providerPaymentStatus?: string | null;
  refundedAt?: Date | null;
  responsePayload?: unknown;
};

export interface PaymentsRepository {
  findPaymentById(paymentId: string): Promise<TripPaymentRecord | null>;
  findPaymentByTripRequestId(tripRequestId: string): Promise<TripPaymentRecord | null>;
  findPaymentByProviderOrderToken(providerOrderToken: string): Promise<TripPaymentRecord | null>;
  listPaymentsByTripId(tripId: string): Promise<TripPaymentRecord[]>;
  upsertAcceptedTripRequestPayment(
    input: UpsertAcceptedTripRequestPaymentInput,
  ): Promise<TripPaymentRecord | null>;
  recordCheckout(input: RecordPaymentCheckoutInput): Promise<TripPaymentRecord>;
  syncPaymentStatus(input: SyncPaymentStatusInput): Promise<TripPaymentRecord | null>;
  markPaymentCancelledByTripRequestId(
    tripRequestId: string,
    failureReason?: string,
  ): Promise<TripPaymentRecord | null>;
  markPaymentRefunded(input: MarkPaymentRefundedInput): Promise<TripPaymentRecord | null>;
  captureWalletPayment(paymentId: string): Promise<TripPaymentRecord | null>;
  refundWalletPayment(paymentId: string, failureReason?: string): Promise<TripPaymentRecord | null>;
  markPaymentsCancelledByTripId(tripId: string, failureReason?: string): Promise<number>;
  markCashPaymentPaid(paymentId: string): Promise<TripPaymentRecord | null>;
  markCashPaymentFailed(paymentId: string, failureReason: string): Promise<TripPaymentRecord | null>;
}
