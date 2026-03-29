export const TRIP_START_EARLY_WINDOW_MINUTES = 30;

export type TripStartAvailability = 'AVAILABLE' | 'TOO_EARLY' | 'TOO_LATE';

type TripStartAvailabilityInput = {
  departureAt: Date | string;
  estimatedArrivalAt: Date | string;
  now?: Date;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function getTripStartAvailability({
  departureAt,
  estimatedArrivalAt,
  now = new Date(),
}: TripStartAvailabilityInput): TripStartAvailability {
  const departureDate = toDate(departureAt);
  const estimatedArrivalDate = toDate(estimatedArrivalAt);

  if (Number.isNaN(departureDate.getTime()) || Number.isNaN(estimatedArrivalDate.getTime())) {
    return 'TOO_LATE';
  }

  const earlyStartBoundary = new Date(
    departureDate.getTime() - TRIP_START_EARLY_WINDOW_MINUTES * 60_000,
  );

  if (now < earlyStartBoundary) {
    return 'TOO_EARLY';
  }

  if (now > estimatedArrivalDate) {
    return 'TOO_LATE';
  }

  return 'AVAILABLE';
}
