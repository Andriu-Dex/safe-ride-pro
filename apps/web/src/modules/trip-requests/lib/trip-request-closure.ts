import { TripRequestStatus } from '@saferidepro/shared-types';

import type { TripRequestRecord } from '../types/trip-request';

export function wasConfirmedBeforeClosure(request: TripRequestRecord): boolean {
  if (request.status === TripRequestStatus.Accepted || request.status === TripRequestStatus.NoShow) {
    return true;
  }

  return Boolean(
    request.status === TripRequestStatus.Cancelled &&
      request.reviewedAt &&
      request.tripCancelledAt &&
      request.cancelledAt &&
      request.tripCancelledAt === request.cancelledAt,
  );
}
