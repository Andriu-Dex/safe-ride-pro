import {
  LuggagePolicy,
  TripLiveTrackingSignalStatus,
  TripLiveTrackingStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';
import { describe, expect, it } from 'vitest';

import { buildTripLiveTrackingInsights } from './trip-live-tracking-metrics';
import type { TripDetailRecord, TripLiveTrackingRecord } from '../types/trip';

function buildTripDetail(overrides: Partial<TripDetailRecord> = {}): TripDetailRecord {
  return {
    id: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    driverMembershipId: 'membership-driver',
    driverFullName: 'Conductor Uno',
    vehicleId: 'vehicle-1',
    vehiclePlate: 'ABC-123',
    vehicleDisplayName: 'Kia Rio',
    status: TripStatus.InProgress,
    routeMode: TripRouteMode.DirectRoute,
    originLabel: 'Origen',
    destinationLabel: 'Destino',
    departureAt: '2030-01-01T10:00:00.000Z',
    estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
    seatCount: 4,
    availableSeats: 2,
    vehicleTypeSnapshot: VehicleType.Car,
    luggagePolicySnapshot: LuggagePolicy.UpToMedium,
    basePriceReference: 2.5,
    detourSurchargeReference: null,
    notes: null,
    cancelledAt: null,
    createdAt: '2030-01-01T09:00:00.000Z',
    originLatitude: -1.241,
    originLongitude: -78.616,
    destinationLatitude: -1.252,
    destinationLongitude: -78.625,
    ...overrides,
  } as TripDetailRecord;
}

function buildTracking(overrides: Partial<TripLiveTrackingRecord> = {}): TripLiveTrackingRecord {
  return {
    tripId: 'trip-1',
    status: TripLiveTrackingStatus.Active,
    signalStatus: TripLiveTrackingSignalStatus.Live,
    startedAt: '2030-01-01T10:00:00.000Z',
    endedAt: null,
    lastSignalAt: '2030-01-01T10:10:00.000Z',
    lastSignalAgeInSeconds: 10,
    currentLatitude: -1.247,
    currentLongitude: -78.621,
    currentAccuracyMeters: 12,
    currentHeadingDegrees: 120,
    currentSpeedKph: 28,
    history: [
      {
        capturedAt: '2030-01-01T10:01:00.000Z',
        latitude: -1.242,
        longitude: -78.617,
        accuracyMeters: 10,
        headingDegrees: 105,
        speedKph: 18,
      },
      {
        capturedAt: '2030-01-01T10:05:00.000Z',
        latitude: -1.245,
        longitude: -78.619,
        accuracyMeters: 12,
        headingDegrees: 112,
        speedKph: 22,
      },
      {
        capturedAt: '2030-01-01T10:10:00.000Z',
        latitude: -1.247,
        longitude: -78.621,
        accuracyMeters: 12,
        headingDegrees: 120,
        speedKph: 28,
      },
    ],
    ...overrides,
  } as TripLiveTrackingRecord;
}

describe('buildTripLiveTrackingInsights', () => {
  it('computes distance and recent checkpoints from tracking history', () => {
    const insights = buildTripLiveTrackingInsights(
      buildTripDetail(),
      buildTracking(),
      TripStatus.InProgress,
      new Date('2030-01-01T10:15:00.000Z'),
    );

    expect(insights.routeDistanceMeters).toBeGreaterThan(1_000);
    expect(insights.distanceCoveredMeters).toBeGreaterThan(0);
    expect(insights.distanceRemainingMeters).toBeGreaterThan(0);
    expect(insights.geoProgressPercentage).not.toBeNull();
    expect(insights.elapsedSeconds).toBe(900);
    expect(insights.sampledPointCount).toBe(3);
    expect(insights.recentCheckpoints).toHaveLength(3);
    expect(insights.recentCheckpoints[0]?.capturedAt).toBe('2030-01-01T10:10:00.000Z');
  });

  it('returns 100 percent progress for completed trips', () => {
    const insights = buildTripLiveTrackingInsights(
      buildTripDetail({ status: TripStatus.Completed }),
      buildTracking({
        endedAt: '2030-01-01T10:31:00.000Z',
      }),
      TripStatus.Completed,
      new Date('2030-01-01T10:40:00.000Z'),
    );

    expect(insights.geoProgressPercentage).toBe(100);
    expect(insights.elapsedSeconds).toBe(1_860);
  });

  it('handles edge cases, null parameters, invalid dates and fallbacks', () => {
    // 1. All null parameters
    const insightsNull = buildTripLiveTrackingInsights(null, null, TripStatus.InProgress);
    expect(insightsNull.routeDistanceMeters).toBeNull();
    expect(insightsNull.distanceCoveredMeters).toBe(0);
    expect(insightsNull.distanceRemainingMeters).toBeNull();
    expect(insightsNull.geoProgressPercentage).toBeNull();
    expect(insightsNull.elapsedSeconds).toBeNull();
    expect(insightsNull.sampledPointCount).toBe(0);
    expect(insightsNull.recentCheckpoints).toEqual([]);

    // 2. Invalid startedAt date
    const insightsInvalidStart = buildTripLiveTrackingInsights(
      buildTripDetail(),
      buildTracking({ startedAt: 'invalid-date' }),
      TripStatus.InProgress,
    );
    expect(insightsInvalidStart.elapsedSeconds).toBeNull();

    // 3. Invalid endedAt date
    const insightsInvalidEnd = buildTripLiveTrackingInsights(
      buildTripDetail(),
      buildTracking({ endedAt: 'invalid-date' }),
      TripStatus.InProgress,
    );
    expect(insightsInvalidEnd.elapsedSeconds).toBeNull();

    // 4. Missing coordinate latitude/longitude in trip detail
    const insightsMissingCoords = buildTripLiveTrackingInsights(
      buildTripDetail({ originLatitude: null }),
      buildTracking({ currentLatitude: null }),
      TripStatus.InProgress,
    );
    expect(insightsMissingCoords.routeDistanceMeters).toBeNull();

    // 5. Empty tracking history but active tracking reference
    const insightsEmptyHistory = buildTripLiveTrackingInsights(
      buildTripDetail(),
      buildTracking({ history: [] }),
      TripStatus.InProgress,
    );
    expect(insightsEmptyHistory.distanceCoveredMeters).toBe(0);
    expect(insightsEmptyHistory.recentCheckpoints).toEqual([]);

    // 6. clamp progress percentage (progress ratio negative or > 1)
    const insightsClamped = buildTripLiveTrackingInsights(
      buildTripDetail({
        originLatitude: -1.24,
        originLongitude: -78.61,
        destinationLatitude: -1.25,
        destinationLongitude: -78.62,
      }),
      buildTracking({
        currentLatitude: -1.20,
        currentLongitude: -78.50,
        history: [],
      }),
      TripStatus.InProgress,
    );
    expect(insightsClamped.geoProgressPercentage).toBe(0);
  });
});
