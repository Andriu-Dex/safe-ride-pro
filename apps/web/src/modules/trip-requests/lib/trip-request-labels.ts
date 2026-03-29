import { CancellationTiming, TripRequestStatus } from '@saferidepro/shared-types';

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
    case TripRequestStatus.NoShow:
      return 'No-show';
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
    case TripRequestStatus.NoShow:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getTripRequestCancellationTimingLabel(
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
