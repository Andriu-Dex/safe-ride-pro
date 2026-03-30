import {
  OperationalSanctionScope,
  OperationalSanctionType,
} from './operational-sanction-policy';

export enum VisibleReputationState {
  InConstruction = 'IN_CONSTRUCTION',
  Reliable = 'RELIABLE',
  WithObservations = 'WITH_OBSERVATIONS',
  UnderReview = 'UNDER_REVIEW',
  Restricted = 'RESTRICTED',
}

export enum AdministrativeRiskState {
  Normal = 'NORMAL',
  Observed = 'OBSERVED',
  UnderReview = 'UNDER_REVIEW',
  Restricted = 'RESTRICTED',
}

export const TRUST_MIN_RATINGS_FOR_SIGNAL = 3;
export const TRUST_MIN_COMPLETED_INTERACTIONS_FOR_SIGNAL = 5;
export const TRUST_LOW_RATING_THRESHOLD = 3.5;
export const SANCTION_RECURRENCE_WINDOW_DAYS = 90;

export type ActiveOperationalSanctionLike = {
  type: OperationalSanctionType;
  scope: OperationalSanctionScope;
};

export type TrustReputationInput = {
  averageRatingReceived: number | null;
  totalRatingsReceived: number;
  completedTripsAsDriver: number;
  completedTripsAsPassenger: number;
  lateDriverTripCancellations: number;
  latePassengerTripRequestCancellations: number;
  passengerNoShows: number;
  resolvedReportsReceived: number;
  recentSanctionCount: number;
  recentBlockingSanctionCount: number;
  activeSanctions: ActiveOperationalSanctionLike[];
};

export type TrustReputationProfile = {
  completedInteractions: number;
  hasEnoughRatingsSignal: boolean;
  hasLowRatingSignal: boolean;
  visibleReputationState: VisibleReputationState;
  administrativeRiskState: AdministrativeRiskState;
  riskSignals: string[];
};

export function deriveTrustReputationProfile(
  input: TrustReputationInput,
): TrustReputationProfile {
  const completedInteractions =
    input.completedTripsAsDriver + input.completedTripsAsPassenger;
  const hasEnoughRatingsSignal = hasEnoughRatingsSignalData(
    input.totalRatingsReceived,
    completedInteractions,
  );
  const hasLowRatingSignal =
    hasEnoughRatingsSignal &&
    input.averageRatingReceived !== null &&
    input.averageRatingReceived < TRUST_LOW_RATING_THRESHOLD;

  const activeBlockingSanction = input.activeSanctions.some(
    (sanction) => sanction.type !== OperationalSanctionType.Warning,
  );
  const activeWarning = input.activeSanctions.some(
    (sanction) => sanction.type === OperationalSanctionType.Warning,
  );
  const operationalIncidentSignals = [
    input.lateDriverTripCancellations > 0,
    input.latePassengerTripRequestCancellations > 0,
    input.passengerNoShows > 0,
  ];
  const operationalIncidentCategoryCount = operationalIncidentSignals.filter(Boolean).length;
  const hasOperationalIncidents = operationalIncidentCategoryCount > 0;
  const hasResolvedReportSignal = input.resolvedReportsReceived > 0;
  const hasRecentSanctionHistory = input.recentSanctionCount > 0;
  const hasRecentBlockingSanctionHistory = input.recentBlockingSanctionCount > 0;

  const riskSignals = buildRiskSignals({
    activeBlockingSanction,
    activeWarning,
    hasEnoughRatingsSignal,
    hasLowRatingSignal,
    hasOperationalIncidents,
    hasResolvedReportSignal,
    hasRecentSanctionHistory,
    hasRecentBlockingSanctionHistory,
  });

  const administrativeRiskState = deriveAdministrativeRiskState({
    activeBlockingSanction,
    activeWarning,
    hasLowRatingSignal,
    hasOperationalIncidents,
    operationalIncidentCategoryCount,
    hasResolvedReportSignal,
    hasRecentSanctionHistory,
    hasRecentBlockingSanctionHistory,
  });

  const visibleReputationState = deriveVisibleReputationState({
    administrativeRiskState,
    hasEnoughRatingsSignal,
  });

  return {
    completedInteractions,
    hasEnoughRatingsSignal,
    hasLowRatingSignal,
    visibleReputationState,
    administrativeRiskState,
    riskSignals,
  };
}

export function getRecurrenceDurationMultiplier(
  recentBlockingSanctionCount: number,
): number {
  return recentBlockingSanctionCount > 0 ? 2 : 1;
}

function hasEnoughRatingsSignalData(
  totalRatingsReceived: number,
  completedInteractions: number,
): boolean {
  return (
    totalRatingsReceived >= TRUST_MIN_RATINGS_FOR_SIGNAL &&
    completedInteractions >= TRUST_MIN_COMPLETED_INTERACTIONS_FOR_SIGNAL
  );
}

function deriveAdministrativeRiskState(input: {
  activeBlockingSanction: boolean;
  activeWarning: boolean;
  hasLowRatingSignal: boolean;
  hasOperationalIncidents: boolean;
  operationalIncidentCategoryCount: number;
  hasResolvedReportSignal: boolean;
  hasRecentSanctionHistory: boolean;
  hasRecentBlockingSanctionHistory: boolean;
}): AdministrativeRiskState {
  if (input.activeBlockingSanction) {
    return AdministrativeRiskState.Restricted;
  }

  if (
    input.hasResolvedReportSignal ||
    (input.hasLowRatingSignal &&
      (input.hasOperationalIncidents || input.hasRecentBlockingSanctionHistory)) ||
    (input.operationalIncidentCategoryCount >= 2 && input.hasRecentSanctionHistory)
  ) {
    return AdministrativeRiskState.UnderReview;
  }

  if (
    input.activeWarning ||
    input.hasLowRatingSignal ||
    input.hasOperationalIncidents ||
    input.hasRecentSanctionHistory
  ) {
    return AdministrativeRiskState.Observed;
  }

  return AdministrativeRiskState.Normal;
}

function deriveVisibleReputationState(input: {
  administrativeRiskState: AdministrativeRiskState;
  hasEnoughRatingsSignal: boolean;
}): VisibleReputationState {
  switch (input.administrativeRiskState) {
    case AdministrativeRiskState.Restricted:
      return VisibleReputationState.Restricted;
    case AdministrativeRiskState.UnderReview:
      return VisibleReputationState.UnderReview;
    case AdministrativeRiskState.Observed:
      return VisibleReputationState.WithObservations;
    case AdministrativeRiskState.Normal:
    default:
      return input.hasEnoughRatingsSignal
        ? VisibleReputationState.Reliable
        : VisibleReputationState.InConstruction;
  }
}

function buildRiskSignals(input: {
  activeBlockingSanction: boolean;
  activeWarning: boolean;
  hasEnoughRatingsSignal: boolean;
  hasLowRatingSignal: boolean;
  hasOperationalIncidents: boolean;
  hasResolvedReportSignal: boolean;
  hasRecentSanctionHistory: boolean;
  hasRecentBlockingSanctionHistory: boolean;
}): string[] {
  const reasons: string[] = [];

  if (!input.hasEnoughRatingsSignal) {
    reasons.push(
      'Tu reputacion visible aun esta en construccion porque todavia no hay suficientes viajes completados y calificaciones.',
    );
  }

  if (input.activeBlockingSanction) {
    reasons.push(
      'Existe una sancion operativa activa que restringe temporalmente tu operacion.',
    );
  } else if (input.activeWarning) {
    reasons.push('Existe una advertencia operativa activa sobre tu membresia.');
  }

  if (input.hasLowRatingSignal) {
    reasons.push(
      `Tu promedio reciente de calificaciones esta por debajo de ${TRUST_LOW_RATING_THRESHOLD.toFixed(1)}/5 con muestra suficiente.`,
    );
  }

  if (input.hasOperationalIncidents) {
    reasons.push(
      'Se detectaron incidentes operativos recientes, como cancelaciones tardias o no-show.',
    );
  }

  if (input.hasResolvedReportSignal) {
    reasons.push('Existe al menos un reporte resuelto reciente que requiere seguimiento.');
  }

  if (input.hasRecentBlockingSanctionHistory) {
    reasons.push(
      'Tienes sanciones restrictivas recientes en tu historial y eso agrava la reincidencia.',
    );
  } else if (input.hasRecentSanctionHistory) {
    reasons.push('Tienes sanciones o advertencias recientes dentro de la ventana de reincidencia.');
  }

  return reasons;
}
