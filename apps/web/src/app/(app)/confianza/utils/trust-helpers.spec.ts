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
import { ApiError } from '../../../../lib/api-client';
import {
  buildRatingOpportunities,
  buildReportOpportunities,
  getInitialReportDraft,
  formatDateTime,
  getApiErrorMessage,
  formatAverageScore,
  sortByDepartureDateDescending,
  getIncidentSummary,
  getSuggestedReportReason,
  matchesClosureFocus,
  buildClosureOpportunityElementId,
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

  it('does not create rating opportunities outside the closure window or when not accepted or draft status', () => {
    // 1. Outside closure window
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-05T12:00:00.000Z'));
    try {
      const opportunities = buildRatingOpportunities('passenger-1', [buildTripRequest()], []);
      expect(opportunities).toEqual([]);
    } finally {
      vi.useRealTimers();
    }

    // 2. Request status is not Accepted
    const opsNotAccepted = buildRatingOpportunities('passenger-1', [buildTripRequest({ status: TripRequestStatus.Pending })], []);
    expect(opsNotAccepted).toEqual([]);

    // 3. Trip is Draft (no closure summary or canCreateRating is false)
    const opsDraft = buildRatingOpportunities('passenger-1', [buildTripRequest({ tripStatus: TripStatus.Draft })], []);
    expect(opsDraft).toEqual([]);

    // 4. Same checks for incomingRequests (driver perspective)
    const opsIncomingNotAccepted = buildRatingOpportunities('driver-1', [], [buildTripRequest({ status: TripRequestStatus.Pending })]);
    expect(opsIncomingNotAccepted).toEqual([]);

    const opsIncomingDraft = buildRatingOpportunities('driver-1', [], [buildTripRequest({ tripStatus: TripStatus.Draft })]);
    expect(opsIncomingDraft).toEqual([]);
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

  it('excludes opportunities when wasConfirmedBeforeClosure is false or cannot create incident report', () => {
    // 1. Not confirmed (status is Pending)
    const opsNotConfirmed = buildReportOpportunities(
      'passenger-1',
      [
        buildTripRequest({
          status: TripRequestStatus.Pending,
        }),
      ],
      [],
    );
    expect(opsNotConfirmed).toEqual([]);

    // 2. Confirmed but cannot create report (e.g., trip status is Draft)
    const opsCannotReport = buildReportOpportunities(
      'passenger-1',
      [
        buildTripRequest({
          status: TripRequestStatus.Accepted,
          tripStatus: TripStatus.Draft,
        }),
      ],
      [],
    );
    expect(opsCannotReport).toEqual([]);
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

  it('handles incoming requests report opportunities correctly including exclusions and successful paths', () => {
    // 1. Rejected status (should return empty)
    const ops1 = buildReportOpportunities(
      'driver-1',
      [],
      [
        buildTripRequest({
          driverMembershipId: 'driver-1',
          status: TripRequestStatus.Rejected,
        }),
      ],
    );
    expect(ops1).toEqual([]);

    // 2. Mismatched driverMembershipId (should return empty)
    const ops2 = buildReportOpportunities(
      'driver-1',
      [],
      [
        buildTripRequest({
          driverMembershipId: 'driver-2',
          status: TripRequestStatus.Accepted,
        }),
      ],
    );
    expect(ops2).toEqual([]);

    // 3. Successful incoming request report opportunity (completed / overdue)
    const ops3 = buildReportOpportunities(
      'driver-1',
      [],
      [
        buildTripRequest({
          driverMembershipId: 'driver-1',
          status: TripRequestStatus.Accepted,
          tripStatus: TripStatus.Completed,
          tripCompletedAt: '2030-01-01T10:22:00.000Z',
        }),
      ],
    );
    expect(ops3).toHaveLength(1);
    expect(ops3[0]).toMatchObject({
      id: 'trip-1:passenger-1',
      targetMembershipId: 'passenger-1',
      reportDirectionLabel: 'Reportar al pasajero',
      incidentSummary: 'Viaje completado.',
    });
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

  describe('utility functions', () => {
    it('formatDateTime formats date string to local string', () => {
      const formatted = formatDateTime('2030-01-01T10:00:00.000Z');
      expect(formatted).toBeDefined();
    });

    it('getApiErrorMessage handles ApiError and fallback messages', () => {
      const apiError = new ApiError('Custom API Error message', 400);
      expect(getApiErrorMessage(apiError, 'Fallback')).toBe('Custom API Error message');

      const regularError = new Error('Regular error');
      expect(getApiErrorMessage(regularError, 'Fallback')).toBe('Fallback');
    });

    it('formatAverageScore formats score correctly', () => {
      expect(formatAverageScore(null)).toBe('Sin datos');
      expect(formatAverageScore(4.56)).toBe('4.6/5');
    });

    it('sortByDepartureDateDescending sorts descending', () => {
      const list = [
        { tripDepartureAt: '2030-01-01T10:00:00.000Z' },
        { tripDepartureAt: '2030-01-01T12:00:00.000Z' },
        { tripDepartureAt: '2030-01-01T08:00:00.000Z' },
      ];
      const sorted = sortByDepartureDateDescending(list);
      expect(sorted[0].tripDepartureAt).toBe('2030-01-01T12:00:00.000Z');
      expect(sorted[1].tripDepartureAt).toBe('2030-01-01T10:00:00.000Z');
      expect(sorted[2].tripDepartureAt).toBe('2030-01-01T08:00:00.000Z');
    });

    it('getIncidentSummary maps types', () => {
      const { TripClosureIncidentType } = require('@saferidepro/shared-types');
      expect(getIncidentSummary(TripClosureIncidentType.Completed)).toBe('Viaje completado.');
      expect(getIncidentSummary(TripClosureIncidentType.LateDriverCancellation)).toBe('Cancelacion tardia.');
      expect(getIncidentSummary(TripClosureIncidentType.DriverAbsence)).toBe('Ausencia del conductor.');
      expect(getIncidentSummary(TripClosureIncidentType.OverdueInProgress)).toBe('Viaje vencido sin cierre.');
      expect(getIncidentSummary('UNKNOWN' as any)).toBe('Incidente operativo.');
    });

    it('getSuggestedReportReason maps types', () => {
      const { TripClosureIncidentType } = require('@saferidepro/shared-types');
      expect(getSuggestedReportReason(TripClosureIncidentType.LateDriverCancellation)).toBe('NO_SHOW');
      expect(getSuggestedReportReason(TripClosureIncidentType.DriverAbsence)).toBe('NO_SHOW');
      expect(getSuggestedReportReason(TripClosureIncidentType.OverdueInProgress)).toBe('OTHER');
      expect(getSuggestedReportReason(TripClosureIncidentType.Completed)).toBe('UNSAFE_DRIVING');
      expect(getSuggestedReportReason('UNKNOWN' as any)).toBe('UNSAFE_DRIVING');
    });

    it('buildRatingOpportunities and buildReportOpportunities return empty array when membershipId is empty', () => {
      expect(buildRatingOpportunities(undefined, [], [])).toEqual([]);
      expect(buildReportOpportunities(undefined, [], [])).toEqual([]);
    });

    it('getInitialReportDraft fallback when opportunity is undefined', () => {
      expect(getInitialReportDraft(undefined)).toEqual({
        reason: 'UNSAFE_DRIVING',
        description: '',
        evidenceFileKey: '',
        evidenceFileName: '',
        evidencePreviewUrl: null,
        evidenceMimeType: null,
      });
    });

    it('matchesClosureFocus checks focus status', () => {
      expect(matchesClosureFocus('trip-1', 'member-1', null, null)).toBe(false);
      expect(matchesClosureFocus('trip-1', 'member-1', 'trip-2', null)).toBe(false);
      expect(matchesClosureFocus('trip-1', 'member-1', 'trip-1', 'member-2')).toBe(false);
      expect(matchesClosureFocus('trip-1', 'member-1', 'trip-1', null)).toBe(true);
      expect(matchesClosureFocus('trip-1', 'member-1', 'trip-1', 'member-1')).toBe(true);
    });

    it('buildClosureOpportunityElementId replaces non-alphanumeric characters', () => {
      expect(buildClosureOpportunityElementId('rating', '123:abc')).toBe('closure-focus-rating-123-abc');
    });
  });
});
