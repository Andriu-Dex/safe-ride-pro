import {
  CancellationTiming,
  DriverLicenseStatus,
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  TripAvailabilityFilter,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';

export const TRIPS_REPOSITORY = Symbol('TRIPS_REPOSITORY');

export type TripMembershipRecord = {
  id: string;
  institutionId: string;
  institutionName: string;
  membershipStatus: MembershipStatus;
  driverVerificationStatus: DriverVerificationStatus;
  effectiveDriverVerificationStatus?: DriverVerificationStatus;
  licenseExpiresAt?: Date | null;
  licenseStatus?: DriverLicenseStatus;
  licenseExpiresInDays?: number | null;
};

export type TripVehicleRecord = {
  id: string;
  membershipId: string;
  isActive: boolean;
  seatCount: number;
  luggagePolicy: LuggagePolicy;
  vehicleType: VehicleType;
  plate: string;
  displayName: string;
};

export type TripRecord = {
  id: string;
  institutionId: string;
  institutionName: string;
  driverMembershipId: string;
  driverFullName: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleDisplayName: string;
  status: TripStatus;
  routeMode: TripRouteMode;
  originLabel: string;
  destinationLabel: string;
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  departureAt: Date;
  estimatedArrivalAt: Date;
  seatCount: number;
  availableSeats: number;
  vehicleTypeSnapshot: VehicleType;
  luggagePolicySnapshot: LuggagePolicy;
  basePriceReference: number;
  detourSurchargeReference: number | null;
  notes: string | null;
  cancelledAt: Date | null;
  cancellationTiming?: CancellationTiming | null;
  createdAt: Date;
};

export type CreateTripInput = {
  institutionId: string;
  driverMembershipId: string;
  vehicleId: string;
  routeMode: TripRouteMode;
  originLabel: string;
  destinationLabel: string;
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  departureAt: Date;
  estimatedArrivalAt: Date;
  seatCount: number;
  availableSeats: number;
  vehicleTypeSnapshot: VehicleType;
  luggagePolicySnapshot: LuggagePolicy;
  basePriceReference: number;
  detourSurchargeReference?: number;
  notes?: string;
};

export type TripFilters = {
  institutionId?: string;
  driverMembershipId?: string;
  statuses?: TripStatus[];
  originSearch?: string;
  destinationSearch?: string;
  dateFrom?: Date;
  dateTo?: Date;
  timeFromInMinutes?: number;
  timeToInMinutes?: number;
  routeMode?: TripRouteMode;
  vehicleType?: VehicleType;
  availability?: TripAvailabilityFilter;
};

export interface TripsRepository {
  findDefaultMembershipByUserId(userId: string): Promise<TripMembershipRecord | null>;
  findVehicleByIdForMembership(membershipId: string, vehicleId: string): Promise<TripVehicleRecord | null>;
  createTrip(input: CreateTripInput): Promise<TripRecord>;
  findTripById(tripId: string): Promise<TripRecord | null>;
  listTrips(filters: TripFilters): Promise<TripRecord[]>;
  findOverlappingTrips(
    driverMembershipId: string,
    departureAt: Date,
    estimatedArrivalAt: Date,
    excludeTripId?: string,
  ): Promise<TripRecord[]>;
  updateTripStatus(tripId: string, status: TripStatus): Promise<TripRecord>;
  cancelTripAndActiveRequests(tripId: string): Promise<TripRecord>;
  startTripAndClosePendingRequests(tripId: string, autoReviewNote: string): Promise<TripRecord>;
}
