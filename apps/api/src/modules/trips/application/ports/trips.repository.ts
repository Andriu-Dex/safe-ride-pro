import {
  CancellationTiming,
  DriverLicenseStatus,
  DriverVerificationStatus,
  TripRequestExecutionStatus,
  TripRequestStatus,
  LuggagePolicy,
  MembershipStatus,
  TripAvailabilityFilter,
  TripLiveTrackingStatus,
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
  closureNote: string | null;
  cancelledAt: Date | null;
  completedAt: Date | null;
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

export type UpdateTripInput = {
  tripId: string;
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
  status: TripStatus;
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

export type TripExecutionPassengerRecord = {
  requestId: string;
  passengerMembershipId: string;
  passengerFullName: string;
  status: TripRequestStatus;
  executionStatus: TripRequestExecutionStatus | null;
  boardedAt: Date | null;
  droppedOffAt: Date | null;
};

export type TripLiveTrackingPointRecord = {
  capturedAt: Date;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  headingDegrees: number | null;
  speedKph: number | null;
};

export type TripLiveTrackingRecord = {
  tripId: string;
  status: TripLiveTrackingStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  lastSignalAt: Date | null;
  currentLatitude: number | null;
  currentLongitude: number | null;
  currentAccuracyMeters: number | null;
  currentHeadingDegrees: number | null;
  currentSpeedKph: number | null;
  history: TripLiveTrackingPointRecord[];
};

export type RecordTripLiveTrackingPositionInput = {
  tripId: string;
  capturedAt: Date;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedKph?: number;
};

export type CompleteTripInput = {
  tripId: string;
  closureNote?: string | null;
  completedAt: Date;
};

export interface TripsRepository {
  findDefaultMembershipByUserId(userId: string): Promise<TripMembershipRecord | null>;
  findVehicleByIdForMembership(membershipId: string, vehicleId: string): Promise<TripVehicleRecord | null>;
  createTrip(input: CreateTripInput): Promise<TripRecord>;
  updateTrip(input: UpdateTripInput): Promise<TripRecord>;
  findTripById(tripId: string): Promise<TripRecord | null>;
  countActiveRequestsForTrip(tripId: string): Promise<number>;
  listTripExecutionPassengers(tripId: string): Promise<TripExecutionPassengerRecord[]>;
  hasAcceptedTripRequest(tripId: string, passengerMembershipId: string): Promise<boolean>;
  findAcceptedPassengerMembershipIds(tripId: string): Promise<string[]>;
  findLatestReusableTripByDriverMembershipId(
    driverMembershipId: string,
  ): Promise<TripRecord | null>;
  listTrips(filters: TripFilters): Promise<TripRecord[]>;
  findOverlappingTrips(
    driverMembershipId: string,
    departureAt: Date,
    estimatedArrivalAt: Date,
    excludeTripId?: string,
  ): Promise<TripRecord[]>;
  updateTripStatus(tripId: string, status: TripStatus): Promise<TripRecord>;
  completeTrip(input: CompleteTripInput): Promise<TripRecord>;
  autoCancelTripForDriverAbsence(tripId: string): Promise<TripRecord | null>;
  cancelTripAndActiveRequests(tripId: string): Promise<TripRecord>;
  startTripAndClosePendingRequests(tripId: string, autoReviewNote: string): Promise<TripRecord>;
  getTripLiveTrackingByTripId(
    tripId: string,
    historyLimit?: number,
  ): Promise<TripLiveTrackingRecord | null>;
  activateTripLiveTracking(tripId: string): Promise<TripLiveTrackingRecord>;
  recordTripLiveTrackingPosition(
    input: RecordTripLiveTrackingPositionInput,
  ): Promise<TripLiveTrackingRecord>;
  endTripLiveTracking(tripId: string): Promise<TripLiveTrackingRecord | null>;
}
