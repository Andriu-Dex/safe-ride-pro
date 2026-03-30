import type {
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
} from '@saferidepro/shared-types';

export type TrustSummary = {
  membershipId: string;
  averageRatingReceived: number | null;
  totalRatingsReceived: number;
  completedTripsAsDriver: number;
  completedTripsAsPassenger: number;
  lateDriverTripCancellations: number;
  latePassengerTripRequestCancellations: number;
  passengerNoShows: number;
  resolvedReportsReceived: number;
  cancellationPolicy: {
    lateWindowMinutes: number;
    lastComputedAt: string;
  };
  sanctionPolicy?: {
    operationalWindowDays: number;
    reportsWindowDays: number;
    lastComputedAt: string;
  };
  activeSanctions?: {
    id: string;
    type: OperationalSanctionType;
    scope: OperationalSanctionScope;
    status: OperationalSanctionStatus;
    trigger: OperationalSanctionTrigger;
    reason: string;
    startedAt: string;
    endsAt: string | null;
  }[];
};
