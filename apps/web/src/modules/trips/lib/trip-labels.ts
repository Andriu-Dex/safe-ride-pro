import { TripRouteMode, TripStatus } from '@saferidepro/shared-types';

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
