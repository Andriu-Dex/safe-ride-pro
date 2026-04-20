export enum TripLiveTrackingStatus {
  Ready = 'READY',
  Active = 'ACTIVE',
  Ended = 'ENDED',
}

export enum TripLiveTrackingSignalStatus {
  Pending = 'PENDING',
  Live = 'LIVE',
  Delayed = 'DELAYED',
  Offline = 'OFFLINE',
  Closed = 'CLOSED',
}

export const TRIP_LIVE_TRACKING_DELAYED_AFTER_SECONDS = 45;
export const TRIP_LIVE_TRACKING_OFFLINE_AFTER_SECONDS = 120;

type TripLiveTrackingSignalInput = {
  status: TripLiveTrackingStatus;
  lastSignalAt: Date | string | null;
  now?: Date;
};

export function getTripLiveTrackingSignalStatus(
  input: TripLiveTrackingSignalInput,
): TripLiveTrackingSignalStatus {
  if (input.status === TripLiveTrackingStatus.Ready) {
    return TripLiveTrackingSignalStatus.Pending;
  }

  if (input.status === TripLiveTrackingStatus.Ended) {
    return TripLiveTrackingSignalStatus.Closed;
  }

  if (!input.lastSignalAt) {
    return TripLiveTrackingSignalStatus.Pending;
  }

  const signalDate = toDate(input.lastSignalAt);

  if (!signalDate) {
    return TripLiveTrackingSignalStatus.Pending;
  }

  const now = input.now ?? new Date();
  const ageInSeconds = Math.max(0, Math.round((now.getTime() - signalDate.getTime()) / 1_000));

  if (ageInSeconds >= TRIP_LIVE_TRACKING_OFFLINE_AFTER_SECONDS) {
    return TripLiveTrackingSignalStatus.Offline;
  }

  if (ageInSeconds >= TRIP_LIVE_TRACKING_DELAYED_AFTER_SECONDS) {
    return TripLiveTrackingSignalStatus.Delayed;
  }

  return TripLiveTrackingSignalStatus.Live;
}

export function getTripLiveTrackingSignalAgeInSeconds(
  lastSignalAt: Date | string | null,
  now = new Date(),
): number | null {
  if (!lastSignalAt) {
    return null;
  }

  const signalDate = toDate(lastSignalAt);

  if (!signalDate) {
    return null;
  }

  return Math.max(0, Math.round((now.getTime() - signalDate.getTime()) / 1_000));
}

function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}
