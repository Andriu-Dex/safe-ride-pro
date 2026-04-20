import {
  CancellationTiming,
  TripLiveTrackingSignalStatus,
  TripLiveTrackingStatus,
  TripAvailabilityFilter,
  TripRouteMode,
  VehicleType,
} from '@saferidepro/shared-types';

export type TripRecord = {
  id: string;
  institutionId: string;
  institutionName: string;
  driverMembershipId: string;
  driverFullName: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleDisplayName: string;
  status: import('@saferidepro/shared-types').TripStatus;
  routeMode: TripRouteMode;
  originLabel: string;
  destinationLabel: string;
  departureAt: string;
  estimatedArrivalAt: string;
  seatCount: number;
  availableSeats: number;
  vehicleTypeSnapshot: VehicleType;
  luggagePolicySnapshot: import('@saferidepro/shared-types').LuggagePolicy;
  basePriceReference: number;
  detourSurchargeReference: number | null;
  notes: string | null;
  cancelledAt: string | null;
  cancellationTiming: CancellationTiming | null;
  createdAt: string;
};

export type TripDetailRecord = TripRecord & {
  originLatitude: number | null;
  originLongitude: number | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
};

export type TripLiveTrackingPointRecord = {
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  headingDegrees: number | null;
  speedKph: number | null;
};

export type TripLiveTrackingRecord = {
  tripId: string;
  status: TripLiveTrackingStatus;
  signalStatus: TripLiveTrackingSignalStatus;
  startedAt: string | null;
  endedAt: string | null;
  lastSignalAt: string | null;
  lastSignalAgeInSeconds: number | null;
  currentLatitude: number | null;
  currentLongitude: number | null;
  currentAccuracyMeters: number | null;
  currentHeadingDegrees: number | null;
  currentSpeedKph: number | null;
  history: TripLiveTrackingPointRecord[];
};

export type UpdateTripLiveTrackingInput = {
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedKph?: number;
};

export type TripFilters = {
  origin?: string;
  destination?: string;
  dateFrom?: string;
  dateTo?: string;
  timeFrom?: string;
  timeTo?: string;
  routeMode?: TripRouteMode;
  vehicleType?: VehicleType;
  availability?: TripAvailabilityFilter;
};

export type CreateTripInput = {
  vehicleId: string;
  routeMode: TripRouteMode;
  originLabel: string;
  destinationLabel: string;
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  departureAt: string;
  estimatedArrivalAt: string;
  seatCount: number;
  basePriceReference: number;
  detourSurchargeReference?: number;
  notes?: string;
};

export type LatestTripRouteTemplate = {
  sourceTripId: string;
  vehicleId: string;
  vehicleDisplayName: string;
  vehiclePlate: string;
  routeMode: TripRouteMode;
  originLabel: string;
  destinationLabel: string;
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  seatCount: number;
  basePriceReference: number;
  detourSurchargeReference: number | null;
  notes: string | null;
  createdAt: string;
  departureAt: string;
};
