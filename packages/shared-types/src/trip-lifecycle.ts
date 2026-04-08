export const TRIP_DRIVER_ABSENCE_GRACE_MINUTES = 20;
export const TRIP_COMPLETION_OVERDUE_GRACE_MINUTES = 180;

type TripLifecycleInput = {
  status: string;
  departureAt?: Date | string | null;
  estimatedArrivalAt?: Date | string | null;
  now?: Date;
};

function toDate(value?: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function shouldAutoCancelTripForDriverAbsence({
  status,
  departureAt,
  now = new Date(),
}: TripLifecycleInput): boolean {
  if (status !== 'PUBLISHED' && status !== 'FULL') {
    return false;
  }

  const departureDate = toDate(departureAt);

  if (!departureDate) {
    return false;
  }

  const autoCancellationBoundary = new Date(
    departureDate.getTime() + TRIP_DRIVER_ABSENCE_GRACE_MINUTES * 60_000,
  );

  return now >= autoCancellationBoundary;
}

export function isTripCompletionOverdue({
  status,
  estimatedArrivalAt,
  now = new Date(),
}: TripLifecycleInput): boolean {
  if (status !== 'IN_PROGRESS') {
    return false;
  }

  const estimatedArrivalDate = toDate(estimatedArrivalAt);

  if (!estimatedArrivalDate) {
    return false;
  }

  const overdueBoundary = new Date(
    estimatedArrivalDate.getTime() + TRIP_COMPLETION_OVERDUE_GRACE_MINUTES * 60_000,
  );

  return now >= overdueBoundary;
}
