export enum CancellationTiming {
  OnTime = 'ON_TIME',
  Late = 'LATE',
}

export const CANCELLATION_LATE_WINDOW_MINUTES = 30;

type CancellationTimingInput = {
  departureAt?: Date | string | null;
  cancelledAt?: Date | string | null;
  now?: Date;
  lateWindowMinutes?: number | null;
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
  lateWindowMinutes,
}: CancellationTimingInput): CancellationTiming | null {
  const normalizedDepartureAt = normalizeDate(departureAt);
  const normalizedCancelledAt = normalizeDate(cancelledAt);

  if (!normalizedDepartureAt || !normalizedCancelledAt) {
    return null;
  }

  const effectiveLateWindowMinutes =
    typeof lateWindowMinutes === 'number' && Number.isFinite(lateWindowMinutes) && lateWindowMinutes > 0
      ? Math.round(lateWindowMinutes)
      : CANCELLATION_LATE_WINDOW_MINUTES;

  const lateThresholdAt = new Date(
    normalizedDepartureAt.getTime() - effectiveLateWindowMinutes * 60_000,
  );

  return normalizedCancelledAt >= lateThresholdAt
    ? CancellationTiming.Late
    : CancellationTiming.OnTime;
}
