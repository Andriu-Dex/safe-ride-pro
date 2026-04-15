import {
  CancellationTiming,
  MembershipStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';

export const TRIP_REQUESTS_REPOSITORY = Symbol('TRIP_REQUESTS_REPOSITORY');

export type TripRequestMembershipRecord = {
  id: string;
  userId: string;
  fullName: string;
  institutionId: string;
  institutionName: string;
  membershipStatus: MembershipStatus;
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
  tripStatus: TripStatus;
  tripRouteMode: TripRouteMode;
  tripOriginLabel: string;
  tripDestinationLabel: string;
  tripDepartureAt: Date;
  tripEstimatedArrivalAt: Date;
  tripCancelledAt: Date | null;
  tripSeatCount: number;
  tripAvailableSeats: number;
  requestedPickupLatitude: number | null;
  requestedPickupLongitude: number | null;
  requestedDropoffLatitude: number | null;
  requestedDropoffLongitude: number | null;
  requestMessage: string | null;
  reviewNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  cancelledAt: Date | null;
  cancellationTiming: CancellationTiming | null;
};

export type CreateTripRequestInput = {
  tripId: string;
  passengerMembershipId: string;
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
}
