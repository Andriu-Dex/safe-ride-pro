import {
  CancellationTiming,
  TripRequestExecutionStatus,
  TripRequestStatus,
} from '@saferidepro/shared-types';

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
      return 'Ausencia';
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

export function getTripRequestExecutionStatusLabel(
  executionStatus: TripRequestExecutionStatus | null | undefined,
): string {
  switch (executionStatus) {
    case TripRequestExecutionStatus.AcceptedPendingBoarding:
      return 'Por abordar';
    case TripRequestExecutionStatus.OnBoard:
      return 'A bordo';
    case TripRequestExecutionStatus.DroppedOff:
      return 'Finalizado';
    case TripRequestExecutionStatus.NoShow:
      return 'Ausencia';
    case TripRequestExecutionStatus.CancelledBeforeBoarding:
      return 'Cancelado antes de abordar';
    default:
      return 'Sin ejecucion';
  }
}

export function getTripRequestExecutionStatusTone(
  executionStatus: TripRequestExecutionStatus | null | undefined,
): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (executionStatus) {
    case TripRequestExecutionStatus.AcceptedPendingBoarding:
      return 'warning';
    case TripRequestExecutionStatus.OnBoard:
      return 'success';
    case TripRequestExecutionStatus.DroppedOff:
      return 'success';
    case TripRequestExecutionStatus.NoShow:
      return 'danger';
    case TripRequestExecutionStatus.CancelledBeforeBoarding:
      return 'neutral';
    default:
      return 'neutral';
  }
}
