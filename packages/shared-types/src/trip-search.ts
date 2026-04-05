export enum TripAvailabilityFilter {
  Available = 'AVAILABLE',
  Full = 'FULL',
}

export const TRIP_TIME_FILTER_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTripTimeFilterValue(value: string): boolean {
  return TRIP_TIME_FILTER_PATTERN.test(value);
}
