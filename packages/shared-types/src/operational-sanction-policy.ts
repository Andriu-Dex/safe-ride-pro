export enum OperationalSanctionType {
  Warning = 'WARNING',
  LimitedPassenger = 'LIMITED_PASSENGER',
  LimitedDriver = 'LIMITED_DRIVER',
  Suspended = 'SUSPENDED',
}

export enum OperationalSanctionScope {
  Passenger = 'PASSENGER',
  Driver = 'DRIVER',
  All = 'ALL',
}

export enum OperationalSanctionStatus {
  Active = 'ACTIVE',
  Expired = 'EXPIRED',
}

export enum OperationalSanctionTrigger {
  PassengerNoShow = 'PASSENGER_NO_SHOW',
  LateDriverCancellation = 'LATE_DRIVER_CANCELLATION',
  LatePassengerCancellation = 'LATE_PASSENGER_CANCELLATION',
  ResolvedReports = 'RESOLVED_REPORTS',
}

export const SANCTION_OPERATIONAL_WINDOW_DAYS = 30;
export const SANCTION_REPORTS_WINDOW_DAYS = 60;
export const SANCTION_WARNING_DURATION_DAYS = 3;

export type OperationalSanctionMetrics = {
  passengerNoShows: number;
  latePassengerTripRequestCancellations: number;
  lateDriverTripCancellations: number;
  resolvedReportsReceived: number;
  resolvedLowSeverityReportsReceived: number;
  resolvedMediumSeverityReportsReceived: number;
  resolvedHighSeverityReportsReceived: number;
};

export type OperationalSanctionDecision = {
  type: OperationalSanctionType;
  scope: OperationalSanctionScope;
  trigger: OperationalSanctionTrigger;
  durationDays: number;
  reason: string;
  metadata: {
    threshold: number;
    eventCount: number;
    operationalWindowDays?: number;
    reportsWindowDays?: number;
    recurrenceWindowDays?: number;
    recentBlockingSanctionCount?: number;
    durationMultiplier?: number;
    lowSeverityReports?: number;
    mediumSeverityReports?: number;
    highSeverityReports?: number;
  };
};

type CandidatePriority = {
  severity: number;
  durationDays: number;
  triggerPriority: number;
};

export function deriveOperationalSanctionDecisions(
  metrics: OperationalSanctionMetrics,
): OperationalSanctionDecision[] {
  const decisions = [
    resolvePassengerDecision(metrics),
    resolveDriverDecision(metrics),
    resolveGlobalDecision(metrics),
  ].filter((decision): decision is OperationalSanctionDecision => decision !== null);

  return decisions;
}

export function doesSanctionBlockPassengerOperations(
  sanctionType: OperationalSanctionType,
  scope: OperationalSanctionScope,
): boolean {
  return (
    sanctionType !== OperationalSanctionType.Warning &&
    (scope === OperationalSanctionScope.Passenger || scope === OperationalSanctionScope.All)
  );
}

export function doesSanctionBlockDriverOperations(
  sanctionType: OperationalSanctionType,
  scope: OperationalSanctionScope,
): boolean {
  return (
    sanctionType !== OperationalSanctionType.Warning &&
    (scope === OperationalSanctionScope.Driver || scope === OperationalSanctionScope.All)
  );
}

export function getOperationalSanctionScopeLabel(
  scope: OperationalSanctionScope,
): string {
  switch (scope) {
    case OperationalSanctionScope.Passenger:
      return 'pasajero';
    case OperationalSanctionScope.Driver:
      return 'conductor';
    case OperationalSanctionScope.All:
      return 'movilidad';
    default:
      return 'operacion';
  }
}

export function getOperationalSanctionDurationLabel(durationDays: number): string {
  return durationDays === 1 ? '1 dia' : `${durationDays} dias`;
}

function resolvePassengerDecision(
  metrics: OperationalSanctionMetrics,
): OperationalSanctionDecision | null {
  const noShowDecision = resolvePassengerNoShowDecision(metrics.passengerNoShows);
  const lateCancellationDecision = resolveLatePassengerCancellationDecision(
    metrics.latePassengerTripRequestCancellations,
  );

  return pickStrongerDecision(noShowDecision, lateCancellationDecision);
}

function resolveDriverDecision(
  metrics: OperationalSanctionMetrics,
): OperationalSanctionDecision | null {
  if (metrics.lateDriverTripCancellations >= 4) {
    return {
      type: OperationalSanctionType.LimitedDriver,
      scope: OperationalSanctionScope.Driver,
      trigger: OperationalSanctionTrigger.LateDriverCancellation,
      durationDays: 14,
      reason:
        'Se bloqueo temporalmente la publicacion de viajes por reincidencia en cancelaciones tardias como conductor.',
      metadata: {
        threshold: 4,
        eventCount: metrics.lateDriverTripCancellations,
        operationalWindowDays: SANCTION_OPERATIONAL_WINDOW_DAYS,
      },
    };
  }

  if (metrics.lateDriverTripCancellations === 3) {
    return {
      type: OperationalSanctionType.LimitedDriver,
      scope: OperationalSanctionScope.Driver,
      trigger: OperationalSanctionTrigger.LateDriverCancellation,
      durationDays: 7,
      reason:
        'Se bloqueo temporalmente la publicacion de viajes por reincidencia en cancelaciones tardias como conductor.',
      metadata: {
        threshold: 3,
        eventCount: metrics.lateDriverTripCancellations,
        operationalWindowDays: SANCTION_OPERATIONAL_WINDOW_DAYS,
      },
    };
  }

  if (metrics.lateDriverTripCancellations === 2) {
    return {
      type: OperationalSanctionType.Warning,
      scope: OperationalSanctionScope.Driver,
      trigger: OperationalSanctionTrigger.LateDriverCancellation,
      durationDays: SANCTION_WARNING_DURATION_DAYS,
      reason:
        'Se genero una advertencia por reincidencia en cancelaciones tardias como conductor.',
      metadata: {
        threshold: 2,
        eventCount: metrics.lateDriverTripCancellations,
        operationalWindowDays: SANCTION_OPERATIONAL_WINDOW_DAYS,
      },
    };
  }

  return null;
}

function resolveGlobalDecision(
  metrics: OperationalSanctionMetrics,
): OperationalSanctionDecision | null {
  if (metrics.resolvedHighSeverityReportsReceived >= 2) {
    return {
      type: OperationalSanctionType.Suspended,
      scope: OperationalSanctionScope.All,
      trigger: OperationalSanctionTrigger.ResolvedReports,
      durationDays: 21,
      reason:
        'Tu membresia fue suspendida temporalmente por reincidencia en reportes resueltos de alta severidad por administracion.',
      metadata: {
        threshold: 2,
        eventCount: metrics.resolvedHighSeverityReportsReceived,
        reportsWindowDays: SANCTION_REPORTS_WINDOW_DAYS,
        highSeverityReports: metrics.resolvedHighSeverityReportsReceived,
        mediumSeverityReports: metrics.resolvedMediumSeverityReportsReceived,
        lowSeverityReports: metrics.resolvedLowSeverityReportsReceived,
      },
    };
  }

  if (
    metrics.resolvedHighSeverityReportsReceived >= 1 &&
    metrics.resolvedReportsReceived >= 2
  ) {
    return {
      type: OperationalSanctionType.Suspended,
      scope: OperationalSanctionScope.All,
      trigger: OperationalSanctionTrigger.ResolvedReports,
      durationDays: 14,
      reason:
        'Tu membresia fue suspendida temporalmente por un reporte resuelto de alta severidad combinado con reincidencia reciente en reportes administrativos.',
      metadata: {
        threshold: 2,
        eventCount: metrics.resolvedReportsReceived,
        reportsWindowDays: SANCTION_REPORTS_WINDOW_DAYS,
        highSeverityReports: metrics.resolvedHighSeverityReportsReceived,
        mediumSeverityReports: metrics.resolvedMediumSeverityReportsReceived,
        lowSeverityReports: metrics.resolvedLowSeverityReportsReceived,
      },
    };
  }

  if (metrics.resolvedReportsReceived >= 3) {
    return {
      type: OperationalSanctionType.Suspended,
      scope: OperationalSanctionScope.All,
      trigger: OperationalSanctionTrigger.ResolvedReports,
      durationDays: 15,
      reason:
        'Tu membresia fue suspendida temporalmente por reincidencia en reportes resueltos por administracion.',
      metadata: {
        threshold: 3,
        eventCount: metrics.resolvedReportsReceived,
        reportsWindowDays: SANCTION_REPORTS_WINDOW_DAYS,
        highSeverityReports: metrics.resolvedHighSeverityReportsReceived,
        mediumSeverityReports: metrics.resolvedMediumSeverityReportsReceived,
        lowSeverityReports: metrics.resolvedLowSeverityReportsReceived,
      },
    };
  }

  if (metrics.resolvedReportsReceived === 2) {
    return {
      type: OperationalSanctionType.Suspended,
      scope: OperationalSanctionScope.All,
      trigger: OperationalSanctionTrigger.ResolvedReports,
      durationDays: 7,
      reason:
        'Tu membresia fue suspendida temporalmente por reincidencia en reportes resueltos por administracion.',
      metadata: {
        threshold: 2,
        eventCount: metrics.resolvedReportsReceived,
        reportsWindowDays: SANCTION_REPORTS_WINDOW_DAYS,
        highSeverityReports: metrics.resolvedHighSeverityReportsReceived,
        mediumSeverityReports: metrics.resolvedMediumSeverityReportsReceived,
        lowSeverityReports: metrics.resolvedLowSeverityReportsReceived,
      },
    };
  }

  return null;
}

function resolvePassengerNoShowDecision(
  passengerNoShows: number,
): OperationalSanctionDecision | null {
  if (passengerNoShows >= 4) {
    return {
      type: OperationalSanctionType.LimitedPassenger,
      scope: OperationalSanctionScope.Passenger,
      trigger: OperationalSanctionTrigger.PassengerNoShow,
      durationDays: 14,
      reason:
        'Se bloqueo temporalmente la solicitud de viajes por reincidencia en no-show como pasajero.',
      metadata: {
        threshold: 4,
        eventCount: passengerNoShows,
        operationalWindowDays: SANCTION_OPERATIONAL_WINDOW_DAYS,
      },
    };
  }

  if (passengerNoShows === 3) {
    return {
      type: OperationalSanctionType.LimitedPassenger,
      scope: OperationalSanctionScope.Passenger,
      trigger: OperationalSanctionTrigger.PassengerNoShow,
      durationDays: 7,
      reason:
        'Se bloqueo temporalmente la solicitud de viajes por reincidencia en no-show como pasajero.',
      metadata: {
        threshold: 3,
        eventCount: passengerNoShows,
        operationalWindowDays: SANCTION_OPERATIONAL_WINDOW_DAYS,
      },
    };
  }

  if (passengerNoShows === 2) {
    return {
      type: OperationalSanctionType.Warning,
      scope: OperationalSanctionScope.Passenger,
      trigger: OperationalSanctionTrigger.PassengerNoShow,
      durationDays: SANCTION_WARNING_DURATION_DAYS,
      reason: 'Se genero una advertencia por reincidencia en no-show como pasajero.',
      metadata: {
        threshold: 2,
        eventCount: passengerNoShows,
        operationalWindowDays: SANCTION_OPERATIONAL_WINDOW_DAYS,
      },
    };
  }

  return null;
}

function resolveLatePassengerCancellationDecision(
  latePassengerTripRequestCancellations: number,
): OperationalSanctionDecision | null {
  if (latePassengerTripRequestCancellations >= 4) {
    return {
      type: OperationalSanctionType.LimitedPassenger,
      scope: OperationalSanctionScope.Passenger,
      trigger: OperationalSanctionTrigger.LatePassengerCancellation,
      durationDays: 7,
      reason:
        'Se bloqueo temporalmente la solicitud de viajes por reincidencia en cancelaciones tardias como pasajero.',
      metadata: {
        threshold: 4,
        eventCount: latePassengerTripRequestCancellations,
        operationalWindowDays: SANCTION_OPERATIONAL_WINDOW_DAYS,
      },
    };
  }

  if (latePassengerTripRequestCancellations === 3) {
    return {
      type: OperationalSanctionType.LimitedPassenger,
      scope: OperationalSanctionScope.Passenger,
      trigger: OperationalSanctionTrigger.LatePassengerCancellation,
      durationDays: 3,
      reason:
        'Se bloqueo temporalmente la solicitud de viajes por reincidencia en cancelaciones tardias como pasajero.',
      metadata: {
        threshold: 3,
        eventCount: latePassengerTripRequestCancellations,
        operationalWindowDays: SANCTION_OPERATIONAL_WINDOW_DAYS,
      },
    };
  }

  if (latePassengerTripRequestCancellations === 2) {
    return {
      type: OperationalSanctionType.Warning,
      scope: OperationalSanctionScope.Passenger,
      trigger: OperationalSanctionTrigger.LatePassengerCancellation,
      durationDays: SANCTION_WARNING_DURATION_DAYS,
      reason:
        'Se genero una advertencia por reincidencia en cancelaciones tardias como pasajero.',
      metadata: {
        threshold: 2,
        eventCount: latePassengerTripRequestCancellations,
        operationalWindowDays: SANCTION_OPERATIONAL_WINDOW_DAYS,
      },
    };
  }

  return null;
}

function pickStrongerDecision(
  left: OperationalSanctionDecision | null,
  right: OperationalSanctionDecision | null,
): OperationalSanctionDecision | null {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  const leftPriority = getDecisionPriority(left);
  const rightPriority = getDecisionPriority(right);

  if (rightPriority.severity !== leftPriority.severity) {
    return rightPriority.severity > leftPriority.severity ? right : left;
  }

  if (rightPriority.durationDays !== leftPriority.durationDays) {
    return rightPriority.durationDays > leftPriority.durationDays ? right : left;
  }

  if (rightPriority.triggerPriority !== leftPriority.triggerPriority) {
    return rightPriority.triggerPriority > leftPriority.triggerPriority ? right : left;
  }

  return left;
}

function getDecisionPriority(
  decision: OperationalSanctionDecision,
): CandidatePriority {
  return {
    severity: getSanctionSeverity(decision.type),
    durationDays: decision.durationDays,
    triggerPriority: getTriggerPriority(decision.trigger),
  };
}

function getSanctionSeverity(type: OperationalSanctionType): number {
  switch (type) {
    case OperationalSanctionType.Warning:
      return 1;
    case OperationalSanctionType.LimitedPassenger:
    case OperationalSanctionType.LimitedDriver:
      return 2;
    case OperationalSanctionType.Suspended:
      return 3;
    default:
      return 0;
  }
}

function getTriggerPriority(trigger: OperationalSanctionTrigger): number {
  switch (trigger) {
    case OperationalSanctionTrigger.ResolvedReports:
      return 4;
    case OperationalSanctionTrigger.PassengerNoShow:
      return 3;
    case OperationalSanctionTrigger.LateDriverCancellation:
      return 2;
    case OperationalSanctionTrigger.LatePassengerCancellation:
      return 1;
    default:
      return 0;
  }
}
