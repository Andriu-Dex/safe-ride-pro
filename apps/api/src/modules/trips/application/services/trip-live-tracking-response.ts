import {
  getTripLiveTrackingSignalAgeInSeconds,
  getTripLiveTrackingSignalStatus,
  type TripLiveTrackingSignalStatus,
  type TripLiveTrackingStatus,
} from '@saferidepro/shared-types';

import type { TripLiveTrackingRecord } from '../ports/trips.repository';

export type TripLiveTrackingResponse = {
  tripId: string;
  status: TripLiveTrackingStatus;
  signalStatus: TripLiveTrackingSignalStatus;
  startedAt: string | null;
  endedAt: string | null;
  lastSignalAt: string | null;
  lastSignalAgeInSeconds: number | null;
  currentLatitude: number | null;
  currentLongitude: number | null;
  currentAccuracyMeters: number | null;
  currentHeadingDegrees: number | null;
  currentSpeedKph: number | null;
  history: Array<{
    capturedAt: string;
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    headingDegrees: number | null;
    speedKph: number | null;
  }>;
};

export function mapTripLiveTrackingResponse(
  tracking: TripLiveTrackingRecord,
): TripLiveTrackingResponse {
  return {
    tripId: tracking.tripId,
    status: tracking.status,
    signalStatus: getTripLiveTrackingSignalStatus({
      status: tracking.status,
      lastSignalAt: tracking.lastSignalAt,
    }),
    startedAt: tracking.startedAt?.toISOString() ?? null,
    endedAt: tracking.endedAt?.toISOString() ?? null,
    lastSignalAt: tracking.lastSignalAt?.toISOString() ?? null,
    lastSignalAgeInSeconds: getTripLiveTrackingSignalAgeInSeconds(tracking.lastSignalAt),
    currentLatitude: tracking.currentLatitude,
    currentLongitude: tracking.currentLongitude,
    currentAccuracyMeters: tracking.currentAccuracyMeters,
    currentHeadingDegrees: tracking.currentHeadingDegrees,
    currentSpeedKph: tracking.currentSpeedKph,
    history: tracking.history.map((point) => ({
      capturedAt: point.capturedAt.toISOString(),
      latitude: point.latitude,
      longitude: point.longitude,
      accuracyMeters: point.accuracyMeters,
      headingDegrees: point.headingDegrees,
      speedKph: point.speedKph,
    })),
  };
}
