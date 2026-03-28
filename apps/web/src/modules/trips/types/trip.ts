import {
  LuggagePolicy,
  TripRouteMode,
  TripStatus,
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
  status: TripStatus;
  routeMode: TripRouteMode;
  originLabel: string;
  destinationLabel: string;
  departureAt: string;
  estimatedArrivalAt: string;
  seatCount: number;
  availableSeats: number;
  vehicleTypeSnapshot: VehicleType;
  luggagePolicySnapshot: LuggagePolicy;
  basePriceReference: number;
  detourSurchargeReference: number | null;
  notes: string | null;
  createdAt: string;
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
