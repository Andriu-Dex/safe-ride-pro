import {
  CancellationTiming,
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
  tripStatus: TripStatus;
  tripRouteMode: TripRouteMode;
  tripOriginLabel: string;
  tripDestinationLabel: string;
  tripDepartureAt: string;
  tripEstimatedArrivalAt: string;
  tripSeatCount: number;
  tripAvailableSeats: number;
  requestedPickupLatitude: number | null;
  requestedPickupLongitude: number | null;
  requestedDropoffLatitude: number | null;
  requestedDropoffLongitude: number | null;
  requestMessage: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  cancelledAt: string | null;
  cancellationTiming: CancellationTiming | null;
};

export type CreateTripRequestInput = {
  tripId: string;
  requestedPickupLatitude?: number;
  requestedPickupLongitude?: number;
  requestedDropoffLatitude?: number;
  requestedDropoffLongitude?: number;
  requestMessage?: string;
};
