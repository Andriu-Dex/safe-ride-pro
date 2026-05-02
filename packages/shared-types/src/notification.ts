export enum AppNotificationType {
  TripRequestCreated = 'TRIP_REQUEST_CREATED',
  TripRequestAccepted = 'TRIP_REQUEST_ACCEPTED',
  TripRequestRejected = 'TRIP_REQUEST_REJECTED',
  TripRequestCancelled = 'TRIP_REQUEST_CANCELLED',
  PaymentConfirmed = 'PAYMENT_CONFIRMED',
  PaymentActionRequired = 'PAYMENT_ACTION_REQUIRED',
  CashPaymentReported = 'CASH_PAYMENT_REPORTED',
  RatingPending = 'RATING_PENDING',
  TrustAction = 'TRUST_ACTION',
  DriverApplicationUpdated = 'DRIVER_APPLICATION_UPDATED',
  System = 'SYSTEM',
}

export type AppNotificationRecord = {
  id: string;
  institutionId: string;
  recipientMembershipId: string;
  actorUserId: string | null;
  type: AppNotificationType;
  title: string;
  body: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};
