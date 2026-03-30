import type {
  AdministrativeRiskState,
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
  VisibleReputationState,
} from '@saferidepro/shared-types';

export type TrustSummary = {
  membershipId: string;
  averageRatingReceived: number | null;
  totalRatingsReceived: number;
  completedTripsAsDriver: number;
  completedTripsAsPassenger: number;
  completedInteractions: number;
  lateDriverTripCancellations: number;
  latePassengerTripRequestCancellations: number;
  passengerNoShows: number;
  resolvedReportsReceived: number;
  hasEnoughRatingsSignal: boolean;
  hasLowRatingSignal: boolean;
  visibleReputationState: VisibleReputationState;
  administrativeRiskState: AdministrativeRiskState;
  riskSignals: string[];
  cancellationPolicy: {
    lateWindowMinutes: number;
    lastComputedAt: string;
  };
  reputationPolicy: {
    lowRatingThreshold: number;
    minimumRatingsForSignal: number;
    minimumCompletedInteractionsForSignal: number;
    recurrenceWindowDays: number;
    lastComputedAt: string;
  };
  sanctionPolicy?: {
    operationalWindowDays: number;
    reportsWindowDays: number;
    lastComputedAt: string;
  };
  recentSanctionCount: number;
  recentBlockingSanctionCount: number;
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
