import {
  TripClosureIncidentType,
  type TripPostClosureSummary,
} from '@saferidepro/shared-types';

export function formatTripClosureDeadline(value: string): string {
  return new Date(value).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function getTripClosureIncidentLabel(incidentType: TripClosureIncidentType): string {
  switch (incidentType) {
    case TripClosureIncidentType.Completed:
      return 'Cierre completado';
    case TripClosureIncidentType.LateDriverCancellation:
      return 'Cancelacion tardia';
    case TripClosureIncidentType.DriverAbsence:
      return 'Ausencia del conductor';
    case TripClosureIncidentType.OverdueInProgress:
      return 'Cierre vencido';
    default:
      return incidentType;
  }
}

export function getTripClosureIncidentTone(
  incidentType: TripClosureIncidentType,
): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (incidentType) {
    case TripClosureIncidentType.Completed:
      return 'success';
    case TripClosureIncidentType.LateDriverCancellation:
    case TripClosureIncidentType.DriverAbsence:
    case TripClosureIncidentType.OverdueInProgress:
      return 'warning';
    default:
      return 'neutral';
  }
}

export function getTripClosureWindowCopy(summary: TripPostClosureSummary): string | null {
  if (!summary.actionWindowClosesAt) {
    return null;
  }

  const deadline = formatTripClosureDeadline(summary.actionWindowClosesAt.toISOString());

  return summary.isActionWindowOpen
    ? `Disponible hasta ${deadline}.`
    : `La ventana de cierre vencio el ${deadline}.`;
}
