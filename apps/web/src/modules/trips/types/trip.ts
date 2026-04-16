import {
  CancellationTiming,
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
