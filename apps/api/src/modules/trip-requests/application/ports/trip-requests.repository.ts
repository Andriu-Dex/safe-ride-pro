import {
  CancellationTiming,
  PaymentProvider,
  TripRequestExecutionStatus,
  TripPaymentStatus,
  MembershipStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';

import type { TripRoutePathPoint } from '../../../trips/application/ports/trips.repository';

export const TRIP_REQUESTS_REPOSITORY = Symbol('TRIP_REQUESTS_REPOSITORY');
export const WALLET_INSUFFICIENT_BALANCE = 'WALLET_INSUFFICIENT_BALANCE';

export type TripRequestMembershipRecord = {
  id: string;
  userId: string;
  fullName: string;
  institutionId: string;
  institutionName: string;
  membershipStatus: MembershipStatus;
  termsAcceptedAt: Date | null;
  privacyAcceptedAt: Date | null;
  safetyRulesAcceptedAt: Date | null;
};

export type TripRequestTripRecord = {
  id: string;
  institutionId: string;
  institutionName: string;
  driverMembershipId: string;
  driverUserId: string;
  driverFullName: string;
  status: TripStatus;
  routeMode: TripRouteMode;
  originLabel: string;
  destinationLabel: string;
  routePath?: TripRoutePathPoint[] | null;
  routeDistanceMeters?: number | null;
  routeDurationSeconds?: number | null;
  departureAt: Date;
  estimatedArrivalAt: Date;
  seatCount: number;
  availableSeats: number;
};

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
  tripOriginLatitude: number | null;
  tripOriginLongitude: number | null;
  tripDestinationLabel: string;
  tripDestinationLatitude: number | null;
  tripDestinationLongitude: number | null;
  tripRoutePath?: TripRoutePathPoint[] | null;
  tripRouteDistanceMeters?: number | null;
  tripRouteDurationSeconds?: number | null;
  tripDepartureAt: Date;
  tripEstimatedArrivalAt: Date;
  tripCompletedAt: Date | null;
  tripClosureNote: string | null;
  tripCancelledAt: Date | null;
  tripSeatCount: number;
  tripAvailableSeats: number;
  requestedPickupLatitude: number | null;
  requestedPickupLongitude: number | null;
  requestedDropoffLatitude: number | null;
  requestedDropoffLongitude: number | null;
  requestMessage: string | null;
  reviewNote: string | null;
  executionStatusUpdatedAt: Date | null;
  boardedAt: Date | null;
  droppedOffAt: Date | null;
  createdAt: Date;
  reviewedAt: Date | null;
  cancelledAt: Date | null;
  cancellationTiming: CancellationTiming | null;
  payment: {
    id: string;
    provider: PaymentProvider;
    status: TripPaymentStatus;
    currencyCode: string;
    amount: number;
    checkoutUrl: string | null;
    paidAt: Date | null;
    expiresAt: Date | null;
    updatedAt: Date;
  } | null;
};

export type CreateTripRequestInput = {
  tripId: string;
  passengerMembershipId: string;
  paymentProvider: PaymentProvider;
  currencyCode: string;
  requestedPickupLatitude?: number;
  requestedPickupLongitude?: number;
  requestedDropoffLatitude?: number;
  requestedDropoffLongitude?: number;
  requestMessage?: string;
};

export interface TripRequestsRepository {
  findDefaultMembershipByUserId(userId: string): Promise<TripRequestMembershipRecord | null>;
  findTripById(tripId: string): Promise<TripRequestTripRecord | null>;
  findTripRequestById(requestId: string): Promise<TripRequestRecord | null>;
  findActiveRequestForTripAndPassenger(
    tripId: string,
    passengerMembershipId: string,
  ): Promise<TripRequestRecord | null>;
  createTripRequest(input: CreateTripRequestInput): Promise<TripRequestRecord>;
  listTripRequestsByPassengerMembershipId(
    passengerMembershipId: string,
  ): Promise<TripRequestRecord[]>;
  listTripRequestsByDriverMembershipId(
    driverMembershipId: string,
  ): Promise<TripRequestRecord[]>;
  acceptTripRequest(requestId: string, reviewNote?: string): Promise<TripRequestRecord | null>;
  rejectTripRequest(requestId: string, reviewNote?: string): Promise<TripRequestRecord | null>;
  cancelTripRequest(requestId: string): Promise<TripRequestRecord | null>;
  markTripRequestAsNoShow(requestId: string, reviewNote: string): Promise<TripRequestRecord | null>;
  markTripRequestBoarded(requestId: string): Promise<TripRequestRecord | null>;
  markTripRequestDroppedOff(requestId: string): Promise<TripRequestRecord | null>;
}
