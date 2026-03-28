import { TripRequestStatus } from '@saferidepro/shared-types';

export function getTripRequestStatusLabel(status: TripRequestStatus): string {
  switch (status) {
    case TripRequestStatus.Pending:
      return 'Pendiente';
    case TripRequestStatus.Accepted:
      return 'Aceptada';
    case TripRequestStatus.Rejected:
      return 'Rechazada';
    case TripRequestStatus.Cancelled:
      return 'Cancelada';
    default:
      return status;
  }
}

export function getTripRequestStatusTone(status: TripRequestStatus): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case TripRequestStatus.Accepted:
      return 'success';
    case TripRequestStatus.Pending:
      return 'warning';
    case TripRequestStatus.Rejected:
    case TripRequestStatus.Cancelled:
      return 'danger';
    default:
      return 'neutral';
  }
}
