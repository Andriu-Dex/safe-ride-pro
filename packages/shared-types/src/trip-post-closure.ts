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
  completedAt?: Date | string | null;
  cancelledAt?: Date | string | null;
  now?: Date;
};

type PostActionWindowInput = {
  referenceAt?: Date | string | null;
  now?: Date;
};

export type TripPostClosureSummary = {
  canCreateRating: boolean;
  canCreateIncidentReport: boolean;
  incidentType: TripClosureIncidentType | null;
  actionReferenceAt: Date | null;
  actionWindowClosesAt: Date | null;
  isActionWindowOpen: boolean;
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

export function getTripPostActionWindowClosesAt(
  referenceAt?: Date | string | null,
): Date | null {
  const normalizedReferenceAt = toDate(referenceAt);

  if (!normalizedReferenceAt) {
    return null;
  }

  return new Date(
    normalizedReferenceAt.getTime() + TRIP_POST_ACTION_WINDOW_HOURS * 60 * 60_000,
  );
}

export function isWithinTripPostActionWindow({
  referenceAt,
  now = new Date(),
}: PostActionWindowInput): boolean {
  const closingBoundary = getTripPostActionWindowClosesAt(referenceAt);

  return closingBoundary ? now <= closingBoundary : false;
}

export function getTripPostClosureSummary({
  status,
  departureAt,
  estimatedArrivalAt,
  completedAt,
  cancelledAt,
  now = new Date(),
}: TripPostClosureInput): TripPostClosureSummary {
  const normalizedDepartureAt = toDate(departureAt);
  const normalizedEstimatedArrivalAt = toDate(estimatedArrivalAt);
  const normalizedCompletedAt = toDate(completedAt);
  const normalizedCancelledAt = toDate(cancelledAt);

  if (status === 'COMPLETED') {
    const actionReferenceAt =
      normalizedCompletedAt ?? normalizedEstimatedArrivalAt ?? normalizedDepartureAt;
    const actionWindowClosesAt = getTripPostActionWindowClosesAt(actionReferenceAt);
    const isActionWindowOpen = isWithinTripPostActionWindow({
      referenceAt: actionReferenceAt,
      now,
    });

    return {
      canCreateRating: isActionWindowOpen,
      canCreateIncidentReport: isActionWindowOpen,
      incidentType: isActionWindowOpen ? TripClosureIncidentType.Completed : null,
      actionReferenceAt,
      actionWindowClosesAt,
      isActionWindowOpen,
    };
  }

  if (status === 'CANCELLED') {
    const cancellationTiming = getCancellationTiming({
      departureAt: normalizedDepartureAt,
      cancelledAt: normalizedCancelledAt,
    });
    const actionReferenceAt =
      cancellationTiming === CancellationTiming.Late ? normalizedCancelledAt : null;
    const actionWindowClosesAt = getTripPostActionWindowClosesAt(actionReferenceAt);
    const isActionWindowOpen = isWithinTripPostActionWindow({
      referenceAt: actionReferenceAt,
      now,
    });

    if (
      cancellationTiming !== CancellationTiming.Late ||
      !normalizedDepartureAt ||
      !normalizedCancelledAt ||
      !isActionWindowOpen
    ) {
      return {
        canCreateRating: false,
        canCreateIncidentReport: false,
        incidentType: null,
        actionReferenceAt,
        actionWindowClosesAt,
        isActionWindowOpen,
      };
    }

    const driverAbsenceBoundary = addMinutes(
      normalizedDepartureAt,
      TRIP_DRIVER_ABSENCE_GRACE_MINUTES,
    );

    return {
      canCreateRating: false,
      canCreateIncidentReport: true,
      incidentType:
        normalizedCancelledAt >= driverAbsenceBoundary
          ? TripClosureIncidentType.DriverAbsence
          : TripClosureIncidentType.LateDriverCancellation,
      actionReferenceAt,
      actionWindowClosesAt,
      isActionWindowOpen,
    };
  }

  const actionReferenceAt = normalizedEstimatedArrivalAt;
  const actionWindowClosesAt = getTripPostActionWindowClosesAt(actionReferenceAt);
  const isActionWindowOpen = isWithinTripPostActionWindow({
    referenceAt: actionReferenceAt,
    now,
  });

  if (
    isTripCompletionOverdue({
      status,
      estimatedArrivalAt: normalizedEstimatedArrivalAt,
      now,
    }) &&
    isActionWindowOpen
  ) {
    return {
      canCreateRating: false,
      canCreateIncidentReport: true,
      incidentType: TripClosureIncidentType.OverdueInProgress,
      actionReferenceAt,
      actionWindowClosesAt,
      isActionWindowOpen,
    };
  }

  return {
    canCreateRating: false,
    canCreateIncidentReport: false,
    incidentType: null,
    actionReferenceAt,
    actionWindowClosesAt,
    isActionWindowOpen,
  };
}

export function canCreateTripRating(input: TripPostClosureInput): boolean {
  return getTripPostClosureSummary(input).canCreateRating;
}

export function deriveTripClosureIncidentType(
  input: TripPostClosureInput,
): TripClosureIncidentType | null {
  return getTripPostClosureSummary(input).incidentType;
}

export function canCreateTripIncidentReport(input: TripPostClosureInput): boolean {
  return getTripPostClosureSummary(input).canCreateIncidentReport;
}
