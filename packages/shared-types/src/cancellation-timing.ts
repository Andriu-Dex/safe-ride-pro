export enum CancellationTiming {
  OnTime = 'ON_TIME',
  Late = 'LATE',
}

export const CANCELLATION_LATE_WINDOW_MINUTES = 30;

type CancellationTimingInput = {
  departureAt?: Date | string | null;
  cancelledAt?: Date | string | null;
  now?: Date;
};

function normalizeDate(value?: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  const normalizedDate = value instanceof Date ? value : new Date(value);

  return Number.isNaN(normalizedDate.getTime()) ? null : normalizedDate;
}

export function getCancellationTiming({
  departureAt,
  cancelledAt,
}: CancellationTimingInput): CancellationTiming | null {
  const normalizedDepartureAt = normalizeDate(departureAt);
  const normalizedCancelledAt = normalizeDate(cancelledAt);

  if (!normalizedDepartureAt || !normalizedCancelledAt) {
    return null;
  }

  const lateThresholdAt = new Date(
    normalizedDepartureAt.getTime() - CANCELLATION_LATE_WINDOW_MINUTES * 60_000,
  );

  return normalizedCancelledAt >= lateThresholdAt
    ? CancellationTiming.Late
    : CancellationTiming.OnTime;
}
