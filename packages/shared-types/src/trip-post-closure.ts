import { CancellationTiming, getCancellationTiming } from './cancellation-timing';
import {
  isTripCompletionOverdue,
  TRIP_DRIVER_ABSENCE_GRACE_MINUTES,
} from './trip-lifecycle';

export const TRIP_POST_ACTION_WINDOW_HOURS = 72;

export enum TripClosureIncidentType {
  Completed = 'COMPLETED',
  LateDriverCancellation = 'LATE_DRIVER_CANCELLATION',
  DriverAbsence = 'DRIVER_ABSENCE',
  OverdueInProgress = 'OVERDUE_IN_PROGRESS',
}

type TripPostClosureInput = {
  status: string;
  departureAt?: Date | string | null;
  estimatedArrivalAt?: Date | string | null;
  cancelledAt?: Date | string | null;
  now?: Date;
};

type PostActionWindowInput = {
  referenceAt?: Date | string | null;
  now?: Date;
};

function toDate(value?: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value instanceof Date ? value : new Date(value);

  return Number.isNaN(normalizedValue.getTime()) ? null : normalizedValue;
}

function addMinutes(baseDate: Date, minutes: number): Date {
  return new Date(baseDate.getTime() + minutes * 60_000);
}

export function isWithinTripPostActionWindow({
  referenceAt,
  now = new Date(),
}: PostActionWindowInput): boolean {
  const normalizedReferenceAt = toDate(referenceAt);

  if (!normalizedReferenceAt) {
    return false;
  }

  const closingBoundary = new Date(
    normalizedReferenceAt.getTime() + TRIP_POST_ACTION_WINDOW_HOURS * 60 * 60_000,
  );

  return now <= closingBoundary;
}

export function canCreateTripRating({
  status,
  departureAt,
  estimatedArrivalAt,
  now = new Date(),
}: TripPostClosureInput): boolean {
  if (status !== 'COMPLETED') {
    return false;
  }

  return isWithinTripPostActionWindow({
    referenceAt: estimatedArrivalAt ?? departureAt,
    now,
  });
}

export function deriveTripClosureIncidentType({
  status,
  departureAt,
  estimatedArrivalAt,
  cancelledAt,
  now = new Date(),
}: TripPostClosureInput): TripClosureIncidentType | null {
  const normalizedDepartureAt = toDate(departureAt);
  const normalizedEstimatedArrivalAt = toDate(estimatedArrivalAt);
  const normalizedCancelledAt = toDate(cancelledAt);

  if (status === 'COMPLETED') {
    return canCreateTripRating({
      status,
      departureAt: normalizedDepartureAt,
      estimatedArrivalAt: normalizedEstimatedArrivalAt,
      now,
    })
      ? TripClosureIncidentType.Completed
      : null;
  }

  if (status === 'CANCELLED') {
    const cancellationTiming = getCancellationTiming({
      departureAt: normalizedDepartureAt,
      cancelledAt: normalizedCancelledAt,
    });

    if (
      cancellationTiming !== CancellationTiming.Late ||
      !normalizedDepartureAt ||
      !normalizedCancelledAt ||
      !isWithinTripPostActionWindow({
        referenceAt: normalizedCancelledAt,
        now,
      })
    ) {
      return null;
    }

    const driverAbsenceBoundary = addMinutes(
      normalizedDepartureAt,
      TRIP_DRIVER_ABSENCE_GRACE_MINUTES,
    );

    return normalizedCancelledAt >= driverAbsenceBoundary
      ? TripClosureIncidentType.DriverAbsence
      : TripClosureIncidentType.LateDriverCancellation;
  }

  if (
    isTripCompletionOverdue({
      status,
      estimatedArrivalAt: normalizedEstimatedArrivalAt,
      now,
    }) &&
    isWithinTripPostActionWindow({
      referenceAt: normalizedEstimatedArrivalAt,
      now,
    })
  ) {
    return TripClosureIncidentType.OverdueInProgress;
  }

  return null;
}

export function canCreateTripIncidentReport(input: TripPostClosureInput): boolean {
  return deriveTripClosureIncidentType(input) !== null;
}
