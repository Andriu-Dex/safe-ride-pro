import { TripRequestStatus } from '@saferidepro/shared-types';
import { describe, expect, it } from 'vitest';
import { wasConfirmedBeforeClosure } from './trip-request-closure';
import type { TripRequestRecord } from '../types/trip-request';

describe('trip-request-closure', () => {
  it('returns true when status is Accepted or NoShow', () => {
    expect(wasConfirmedBeforeClosure({ status: TripRequestStatus.Accepted } as TripRequestRecord)).toBe(true);
    expect(wasConfirmedBeforeClosure({ status: TripRequestStatus.NoShow } as TripRequestRecord)).toBe(true);
  });

  it('returns true when status is Cancelled and matches cancellation time conditions', () => {
    const record: TripRequestRecord = {
      status: TripRequestStatus.Cancelled,
      reviewedAt: '2026-06-11T12:00:00.000Z',
      tripCancelledAt: '2026-06-11T12:05:00.000Z',
      cancelledAt: '2026-06-11T12:05:00.000Z',
    } as any;

    expect(wasConfirmedBeforeClosure(record)).toBe(true);
  });

  it('returns false when status is Cancelled but conditions do not match', () => {
    // Missing reviewedAt
    expect(wasConfirmedBeforeClosure({
      status: TripRequestStatus.Cancelled,
      tripCancelledAt: 'time',
      cancelledAt: 'time',
    } as any)).toBe(false);

    // Mismatched cancellation times
    expect(wasConfirmedBeforeClosure({
      status: TripRequestStatus.Cancelled,
      reviewedAt: 'time',
      tripCancelledAt: 'time1',
      cancelledAt: 'time2',
    } as any)).toBe(false);

    // Other status
    expect(wasConfirmedBeforeClosure({
      status: TripRequestStatus.Pending,
    } as any)).toBe(false);
  });
});
