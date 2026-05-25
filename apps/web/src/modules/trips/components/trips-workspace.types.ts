import { PaymentProvider, TripRouteMode } from '@saferidepro/shared-types';

export type TripFormValues = {
  vehicleId: string;
  routeMode: TripRouteMode;
  originLabel: string;
  destinationLabel: string;
  originLatitude: string;
  originLongitude: string;
  destinationLatitude: string;
  destinationLongitude: string;
  routePathJson: string;
  routeDistanceMeters: string;
  routeDurationSeconds: string;
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
  routePathJson: '',
  routeDistanceMeters: '',
  routeDurationSeconds: '',
  departureAt: '',
  estimatedArrivalAt: '',
  seatCount: '1',
  basePriceReference: '0',
  detourSurchargeReference: '0',
  notes: '',
};

export type TripRequestDraft = {
  paymentProvider: PaymentProvider;
  requestMessage: string;
  acceptReservationCommitment: boolean;
  requestedPickupLabel: string;
  requestedPickupLatitude: string;
  requestedPickupLongitude: string;
  requestedDropoffLabel: string;
  requestedDropoffLatitude: string;
  requestedDropoffLongitude: string;
};

export const EMPTY_REQUEST_DRAFT: TripRequestDraft = {
  paymentProvider: PaymentProvider.Cash,
  requestMessage: '',
  acceptReservationCommitment: false,
  requestedPickupLabel: '',
  requestedPickupLatitude: '',
  requestedPickupLongitude: '',
  requestedDropoffLabel: '',
  requestedDropoffLatitude: '',
  requestedDropoffLongitude: '',
};
