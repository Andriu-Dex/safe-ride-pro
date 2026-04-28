import { TripStatus } from '@saferidepro/shared-types';

import type {
  TripDetailRecord,
  TripLiveTrackingPointRecord,
  TripLiveTrackingRecord,
} from '../types/trip';

type CoordinatePoint = {
  latitude: number;
  longitude: number;
};

export type TripLiveTrackingCheckpoint = {
  id: string;
  capturedAt: string;
  accuracyMeters: number | null;
  speedKph: number | null;
};

export type TripLiveTrackingInsights = {
  routeDistanceMeters: number | null;
  distanceCoveredMeters: number;
  distanceRemainingMeters: number | null;
  geoProgressPercentage: number | null;
  elapsedSeconds: number | null;
  sampledPointCount: number;
  recentCheckpoints: TripLiveTrackingCheckpoint[];
};

export function buildTripLiveTrackingInsights(
  tripDetail: TripDetailRecord | null,
  liveTracking: TripLiveTrackingRecord | null,
  tripStatus: TripStatus,
  now = new Date(),
): TripLiveTrackingInsights {
  const originPoint = toCoordinatePoint(
    tripDetail?.originLatitude ?? null,
    tripDetail?.originLongitude ?? null,
  );
  const destinationPoint = toCoordinatePoint(
    tripDetail?.destinationLatitude ?? null,
    tripDetail?.destinationLongitude ?? null,
  );
  const routeDistanceMeters =
    originPoint && destinationPoint
      ? calculateDistanceInMeters(originPoint, destinationPoint)
      : null;
  const sampledPointCount = liveTracking?.history.length ?? 0;
  const distanceCoveredMeters = calculateCoveredDistance(liveTracking?.history ?? []);
  const currentReferencePoint =
    toCoordinatePoint(
      liveTracking?.currentLatitude ?? null,
      liveTracking?.currentLongitude ?? null,
    )
    ?? toCoordinatePointFromHistory(liveTracking?.history ?? [])
    ?? originPoint;
  const distanceRemainingMeters =
    currentReferencePoint && destinationPoint
      ? calculateDistanceInMeters(currentReferencePoint, destinationPoint)
      : routeDistanceMeters;
  const geoProgressPercentage = getGeoProgressPercentage(
    tripStatus,
    routeDistanceMeters,
    distanceRemainingMeters,
  );

  return {
    routeDistanceMeters,
    distanceCoveredMeters,
    distanceRemainingMeters,
    geoProgressPercentage,
    elapsedSeconds: calculateElapsedSeconds(
      liveTracking?.startedAt ?? null,
      liveTracking?.endedAt ?? null,
      now,
    ),
    sampledPointCount,
    recentCheckpoints: [...(liveTracking?.history ?? [])]
      .slice(-3)
      .reverse()
      .map((point, index) => ({
        id: `${point.capturedAt}-${index}`,
        capturedAt: point.capturedAt,
        accuracyMeters: point.accuracyMeters,
        speedKph: point.speedKph,
      })),
  };
}

function getGeoProgressPercentage(
  tripStatus: TripStatus,
  routeDistanceMeters: number | null,
  distanceRemainingMeters: number | null,
): number | null {
  if (tripStatus === TripStatus.Completed || tripStatus === TripStatus.Cancelled) {
    return 100;
  }

  if (routeDistanceMeters === null || routeDistanceMeters <= 0 || distanceRemainingMeters === null) {
    return null;
  }

  const completedRatio = 1 - distanceRemainingMeters / routeDistanceMeters;

  return clampPercentage(completedRatio * 100);
}

function calculateCoveredDistance(history: TripLiveTrackingPointRecord[]): number {
  if (history.length < 2) {
    return 0;
  }

  let distanceMeters = 0;

  for (let index = 1; index < history.length; index += 1) {
    distanceMeters += calculateDistanceInMeters(history[index - 1], history[index]);
  }

  return distanceMeters;
}

function calculateElapsedSeconds(
  startedAt: string | null,
  endedAt: string | null,
  now: Date,
): number | null {
  if (!startedAt) {
    return null;
  }

  const startedAtDate = new Date(startedAt);

  if (Number.isNaN(startedAtDate.getTime())) {
    return null;
  }

  const endReference = endedAt ? new Date(endedAt) : now;

  if (Number.isNaN(endReference.getTime())) {
    return null;
  }

  return Math.max(0, Math.round((endReference.getTime() - startedAtDate.getTime()) / 1_000));
}

function toCoordinatePoint(
  latitude: number | null,
  longitude: number | null,
): CoordinatePoint | null {
  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
}

function toCoordinatePointFromHistory(
  history: TripLiveTrackingPointRecord[],
): CoordinatePoint | null {
  const lastPoint = history[history.length - 1];

  if (!lastPoint) {
    return null;
  }

  return {
    latitude: lastPoint.latitude,
    longitude: lastPoint.longitude,
  };
}

function calculateDistanceInMeters(left: CoordinatePoint, right: CoordinatePoint): number {
  const earthRadiusInMeters = 6_371_000;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);

  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2)
    + Math.cos(leftLatitude)
      * Math.cos(rightLatitude)
      * Math.sin(longitudeDelta / 2)
      * Math.sin(longitudeDelta / 2);

  return 2 * earthRadiusInMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
