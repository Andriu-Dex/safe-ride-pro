import {
  AdministrativeRiskState,
  doesSanctionBlockDriverOperations,
  doesSanctionBlockPassengerOperations,
  OperationalSanctionScope,
  OperationalSanctionType,
  VisibleReputationState,
} from '@saferidepro/shared-types';

import type { TrustSummary } from '../types/trust-summary';

type ActiveSanction = NonNullable<TrustSummary['activeSanctions']>[number];

export function getVisibleReputationStateLabel(
  state: VisibleReputationState,
): string {
  switch (state) {
    case VisibleReputationState.InConstruction:
      return 'En construccion';
    case VisibleReputationState.Reliable:
      return 'Confiable';
    case VisibleReputationState.WithObservations:
      return 'Con observaciones';
    case VisibleReputationState.UnderReview:
      return 'En revision';
    case VisibleReputationState.Restricted:
      return 'Restringido';
    default:
      return state;
  }
}

export function getVisibleReputationTone(
  state: VisibleReputationState,
): 'neutral' | 'warning' | 'danger' | 'success' {
  switch (state) {
    case VisibleReputationState.Reliable:
      return 'success';
    case VisibleReputationState.WithObservations:
    case VisibleReputationState.UnderReview:
      return 'warning';
    case VisibleReputationState.Restricted:
      return 'danger';
    case VisibleReputationState.InConstruction:
    default:
      return 'neutral';
  }
}

export function getAdministrativeRiskStateLabel(
  state: AdministrativeRiskState,
): string {
  switch (state) {
    case AdministrativeRiskState.Normal:
      return 'Normal';
    case AdministrativeRiskState.Observed:
      return 'Observado';
    case AdministrativeRiskState.UnderReview:
      return 'En revision';
    case AdministrativeRiskState.Restricted:
      return 'Restringido';
    default:
      return state;
  }
}

export function getAdministrativeRiskTone(
  state: AdministrativeRiskState,
): 'neutral' | 'warning' | 'danger' | 'success' {
  switch (state) {
    case AdministrativeRiskState.Normal:
      return 'success';
    case AdministrativeRiskState.Observed:
    case AdministrativeRiskState.UnderReview:
      return 'warning';
    case AdministrativeRiskState.Restricted:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getOperationalSanctionTypeLabel(type: OperationalSanctionType): string {
  switch (type) {
    case OperationalSanctionType.Warning:
      return 'Advertencia';
    case OperationalSanctionType.LimitedPassenger:
      return 'Restriccion de pasajero';
    case OperationalSanctionType.LimitedDriver:
      return 'Restriccion de conductor';
    case OperationalSanctionType.Suspended:
      return 'Suspension temporal';
    default:
      return type;
  }
}

export function getOperationalSanctionScopeLabel(scope: OperationalSanctionScope): string {
  switch (scope) {
    case OperationalSanctionScope.Passenger:
      return 'Pasajero';
    case OperationalSanctionScope.Driver:
      return 'Conductor';
    case OperationalSanctionScope.All:
      return 'Movilidad';
    default:
      return scope;
  }
}

export function getOperationalSanctionTone(
  type: OperationalSanctionType,
): 'neutral' | 'warning' | 'danger' | 'success' {
  switch (type) {
    case OperationalSanctionType.Warning:
      return 'warning';
    case OperationalSanctionType.LimitedPassenger:
    case OperationalSanctionType.LimitedDriver:
    case OperationalSanctionType.Suspended:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getTrustRestrictions(summary: TrustSummary | null): {
  blocksPassenger: boolean;
  blocksDriver: boolean;
  message: string | null;
} {
  const activeSanctions = summary?.activeSanctions ?? [];

  if (!activeSanctions.length) {
    return {
      blocksPassenger: false,
      blocksDriver: false,
      message: null,
    };
  }

  const blocksPassenger = activeSanctions.some((sanction) =>
    doesSanctionBlockPassengerOperations(sanction.type, sanction.scope),
  );
  const blocksDriver = activeSanctions.some((sanction) =>
    doesSanctionBlockDriverOperations(sanction.type, sanction.scope),
  );

  const primarySanction = activeSanctions.find(
    (sanction) => sanction.type !== OperationalSanctionType.Warning,
  ) ?? activeSanctions[0];

  return {
    blocksPassenger,
    blocksDriver,
    message: primarySanction ? primarySanction.reason : null,
  };
}
