import { TripRouteMode } from '@saferidepro/shared-types';

export type TripFormValues = {
  vehicleId: string;
  routeMode: TripRouteMode;
  originLabel: string;
  destinationLabel: string;
  originLatitude: string;
  originLongitude: string;
  destinationLatitude: string;
  destinationLongitude: string;
  departureAt: string;
  estimatedArrivalAt: string;
  seatCount: string;
  basePriceReference: string;
  detourSurchargeReference: string;
  notes: string;
};

export const EMPTY_TRIP_FORM: TripFormValues = {
  vehicleId: '',
  routeMode: TripRouteMode.DirectRoute,
  originLabel: '',
  destinationLabel: '',
  originLatitude: '',
  originLongitude: '',
  destinationLatitude: '',
  destinationLongitude: '',
  departureAt: '',
  estimatedArrivalAt: '',
  seatCount: '1',
  basePriceReference: '0',
  detourSurchargeReference: '0',
  notes: '',
};

export type TripRequestDraft = {
  requestMessage: string;
  requestedPickupLatitude: string;
  requestedPickupLongitude: string;
  requestedDropoffLatitude: string;
  requestedDropoffLongitude: string;
};

export const EMPTY_REQUEST_DRAFT: TripRequestDraft = {
  requestMessage: '',
  requestedPickupLatitude: '',
  requestedPickupLongitude: '',
  requestedDropoffLatitude: '',
  requestedDropoffLongitude: '',
};
