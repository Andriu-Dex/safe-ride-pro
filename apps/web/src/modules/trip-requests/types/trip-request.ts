import {
  CancellationTiming,
  PaymentProvider,
  TripRequestExecutionStatus,
  TripPaymentStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';

export type TripRequestRecord = {
  id: string;
  tripId: string;
  institutionId: string;
  institutionName: string;
  driverMembershipId: string;
  driverUserId: string;
  driverFullName: string;
  passengerMembershipId: string;
  passengerUserId: string;
  passengerFullName: string;
  status: TripRequestStatus;
  executionStatus: TripRequestExecutionStatus | null;
  tripStatus: TripStatus;
  tripRouteMode: TripRouteMode;
  tripOriginLabel: string;
  tripDestinationLabel: string;
  tripDepartureAt: string;
  tripEstimatedArrivalAt: string;
  tripCompletedAt: string | null;
  tripClosureNote: string | null;
  tripCancelledAt: string | null;
  tripSeatCount: number;
  tripAvailableSeats: number;
  requestedPickupLatitude: number | null;
  requestedPickupLongitude: number | null;
  requestedDropoffLatitude: number | null;
  requestedDropoffLongitude: number | null;
  requestMessage: string | null;
  reviewNote: string | null;
  executionStatusUpdatedAt: string | null;
  boardedAt: string | null;
  droppedOffAt: string | null;
  createdAt: string;
  reviewedAt: string | null;
  cancelledAt: string | null;
  cancellationTiming: CancellationTiming | null;
  payment: {
    id: string;
    provider: PaymentProvider;
    status: TripPaymentStatus;
    currencyCode: string;
    amount: number;
    checkoutUrl: string | null;
    paidAt: string | null;
    expiresAt: string | null;
    updatedAt: string;
  } | null;
};

export type CreateTripRequestInput = {
  tripId: string;
  paymentProvider?: PaymentProvider;
  requestedPickupLatitude?: number;
  requestedPickupLongitude?: number;
  requestedDropoffLatitude?: number;
  requestedDropoffLongitude?: number;
  requestMessage?: string;
};
