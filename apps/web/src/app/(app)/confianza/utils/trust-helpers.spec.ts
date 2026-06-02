import {
  CancellationTiming,
  PaymentProvider,
  TripPaymentStatus,
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';
import { describe, expect, it, vi } from 'vitest';

import type { TripRequestRecord } from '../../../../modules/trip-requests/types/trip-request';
import {
  buildRatingOpportunities,
  buildReportOpportunities,
  getInitialReportDraft,
} from './trust-helpers';

function buildTripRequest(
  overrides: Partial<TripRequestRecord> = {},
): TripRequestRecord {
  return {
    id: 'request-1',
    tripId: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    driverMembershipId: 'driver-1',
    driverUserId: 'user-driver-1',
    driverFullName: 'Conductor Uno',
    passengerMembershipId: 'passenger-1',
    passengerUserId: 'user-passenger-1',
    passengerFullName: 'Pasajero Uno',
    status: TripRequestStatus.Accepted,
    executionStatus: TripRequestExecutionStatus.DroppedOff,
    tripStatus: TripStatus.Completed,
    tripRouteMode: TripRouteMode.DirectRoute,
    tripOriginLabel: 'Campus Huachi',
    tripOriginLatitude: -1.262,
    tripOriginLongitude: -78.64,
    tripDestinationLabel: 'Santa Rosa',
    tripDestinationLatitude: -1.25,
    tripDestinationLongitude: -78.61,
    tripRoutePath: null,
    tripRouteDistanceMeters: 5000,
    tripRouteDurationSeconds: 900,
    tripDepartureAt: '2030-01-01T10:00:00.000Z',
    tripEstimatedArrivalAt: '2030-01-01T10:20:00.000Z',
    tripCompletedAt: '2030-01-01T10:22:00.000Z',
    tripClosureNote: null,
    tripCancelledAt: null,
    tripSeatCount: 4,
    tripAvailableSeats: 3,
    requestedPickupLatitude: null,
    requestedPickupLongitude: null,
    requestedDropoffLatitude: null,
    requestedDropoffLongitude: null,
    requestMessage: null,
    reviewNote: null,
    executionStatusUpdatedAt: '2030-01-01T10:22:00.000Z',
    boardedAt: '2030-01-01T10:05:00.000Z',
    droppedOffAt: '2030-01-01T10:22:00.000Z',
    createdAt: '2030-01-01T09:00:00.000Z',
    reviewedAt: '2030-01-01T09:05:00.000Z',
    cancelledAt: null,
    cancellationTiming: null,
    payment: {
      id: 'payment-1',
      provider: PaymentProvider.Cash,
      status: TripPaymentStatus.Pending,
      currencyCode: 'USD',
      amount: 2.5,
      checkoutUrl: null,
      paidAt: null,
      expiresAt: null,
      updatedAt: '2030-01-01T09:05:00.000Z',
    },
    ...overrides,
  };
}

describe('trust-helpers', () => {
  it('builds a passenger rating opportunity for a completed accepted trip', () => {
    const opportunities = buildRatingOpportunities('passenger-1', [buildTripRequest()], []);

    expect(opportunities).toEqual([
      expect.objectContaining({
        id: 'trip-1:driver-1',
        targetMembershipId: 'driver-1',
        targetFullName: 'Conductor Uno',
        ratingDirectionLabel: 'Calificar al conductor',
      }),
    ]);
  });

  it('builds a driver rating opportunity for accepted passengers on completed trips', () => {
    const opportunities = buildRatingOpportunities('driver-1', [], [buildTripRequest()]);

    expect(opportunities).toEqual([
      expect.objectContaining({
        id: 'trip-1:passenger-1',
        targetMembershipId: 'passenger-1',
        targetFullName: 'Pasajero Uno',
        ratingDirectionLabel: 'Calificar al pasajero',
      }),
    ]);
  });

  it('does not create rating opportunities outside the closure window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-05T12:00:00.000Z'));

    try {
      const opportunities = buildRatingOpportunities('passenger-1', [buildTripRequest()], []);
      expect(opportunities).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('builds a passenger report opportunity for late driver cancellation', () => {
    const opportunities = buildReportOpportunities(
      'passenger-1',
      [
        buildTripRequest({
          status: TripRequestStatus.Cancelled,
          executionStatus: null,
          tripStatus: TripStatus.Cancelled,
          tripCancelledAt: '2030-01-01T09:55:00.000Z',
          tripCompletedAt: null,
          cancelledAt: '2030-01-01T09:55:00.000Z',
          cancellationTiming: CancellationTiming.Late,
        }),
      ],
      [],
    );

    expect(opportunities).toEqual([
      expect.objectContaining({
        id: 'trip-1:driver-1',
        targetMembershipId: 'driver-1',
        reportDirectionLabel: 'Reportar al conductor',
        incidentSummary: 'Cancelacion tardia.',
        suggestedReason: 'NO_SHOW',
      }),
    ]);
  });

  it('does not create a driver report opportunity for driver absence incidents', () => {
    const opportunities = buildReportOpportunities(
      'driver-1',
      [],
      [
        buildTripRequest({
          status: TripRequestStatus.Accepted,
          tripStatus: TripStatus.Cancelled,
          tripCancelledAt: '2030-01-01T10:20:00.000Z',
          tripCompletedAt: null,
        }),
      ],
    );

    expect(opportunities).toEqual([]);
  });

  it('initializes report draft with the suggested reason from the opportunity', () => {
    const [opportunity] = buildReportOpportunities(
      'passenger-1',
      [
        buildTripRequest({
          status: TripRequestStatus.Cancelled,
          executionStatus: null,
          tripStatus: TripStatus.Cancelled,
          tripCancelledAt: '2030-01-01T09:55:00.000Z',
          tripCompletedAt: null,
          cancelledAt: '2030-01-01T09:55:00.000Z',
          cancellationTiming: CancellationTiming.Late,
        }),
      ],
      [],
    );

    expect(getInitialReportDraft(opportunity)).toMatchObject({
      reason: 'NO_SHOW',
      description: '',
      evidenceFileKey: '',
    });
  });
});
