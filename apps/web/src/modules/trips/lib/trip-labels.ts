import {
  CancellationTiming,
  isTripCompletionOverdue,
  getTripStartAvailability,
  TripAvailabilityFilter,
  TRIP_COMPLETION_OVERDUE_GRACE_MINUTES,
  TRIP_START_EARLY_WINDOW_MINUTES,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';

export function getTripStatusLabel(status: TripStatus): string {
  switch (status) {
    case TripStatus.Draft:
      return 'Borrador';
    case TripStatus.Published:
      return 'Publicado';
    case TripStatus.Full:
      return 'Sin cupos';
    case TripStatus.InProgress:
      return 'En curso';
    case TripStatus.Completed:
      return 'Completado';
    case TripStatus.Cancelled:
      return 'Cancelado';
    default:
      return status;
  }
}

export function getTripStatusTone(status: TripStatus): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case TripStatus.Published:
    case TripStatus.Full:
      return 'success';
    case TripStatus.InProgress:
      return 'warning';
    case TripStatus.Cancelled:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getTripRouteModeLabel(routeMode: TripRouteMode): string {
  switch (routeMode) {
    case TripRouteMode.DirectRoute:
      return 'Ruta directa';
    case TripRouteMode.PlannedDetour:
      return 'Ruta con desvio';
    default:
      return routeMode;
  }
}

export function getTripAvailabilityFilterLabel(
  availability: TripAvailabilityFilter,
): string {
  switch (availability) {
    case TripAvailabilityFilter.Available:
      return 'Solo con cupos';
    case TripAvailabilityFilter.Full:
      return 'Solo sin cupos';
    default:
      return availability;
  }
}

export function getCancellationTimingLabel(
  cancellationTiming: CancellationTiming | null | undefined,
): string | null {
  switch (cancellationTiming) {
    case CancellationTiming.Late:
      return 'Cancelacion tardia';
    case CancellationTiming.OnTime:
      return 'Cancelacion a tiempo';
    default:
      return null;
  }
}

export function getCancellationTimingTone(
  cancellationTiming: CancellationTiming | null | undefined,
): 'neutral' | 'warning' {
  return cancellationTiming === CancellationTiming.Late ? 'warning' : 'neutral';
}

export function canStartTripNow(
  departureAt: string,
  estimatedArrivalAt: string,
): boolean {
  return getTripStartAvailability({
    departureAt,
    estimatedArrivalAt,
  }) === 'AVAILABLE';
}

export function getTripStartAvailabilityMessage(
  departureAt: string,
  estimatedArrivalAt: string,
): string | null {
  const availability = getTripStartAvailability({
    departureAt,
    estimatedArrivalAt,
  });

  switch (availability) {
    case 'TOO_EARLY':
      return `Podras iniciar este viaje dentro de los ${TRIP_START_EARLY_WINDOW_MINUTES} minutos previos a la salida programada.`;
    case 'TOO_LATE':
      return 'La hora estimada de llegada ya vencio, por lo que este viaje ya no puede iniciarse.';
    default:
      return null;
  }
}

export function getTripCompletionOverdueMessage(
  status: TripStatus,
  estimatedArrivalAt: string,
): string | null {
  if (!isTripCompletionOverdue({ status, estimatedArrivalAt })) {
    return null;
  }

  return `Este viaje supera por mas de ${Math.floor(TRIP_COMPLETION_OVERDUE_GRACE_MINUTES / 60)} horas su llegada estimada y deberia revisarse o finalizarse.`;
}
