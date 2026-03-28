import { DriverVerificationStatus } from '@saferidepro/shared-types';

export function getDriverStatusLabel(status: DriverVerificationStatus): string {
  switch (status) {
    case DriverVerificationStatus.NotRequested:
      return 'No solicitado';
    case DriverVerificationStatus.PendingVerification:
      return 'Pendiente de revision';
    case DriverVerificationStatus.Approved:
      return 'Aprobado';
    case DriverVerificationStatus.Rejected:
      return 'Rechazado';
    case DriverVerificationStatus.Suspended:
      return 'Suspendido';
    default:
      return status;
  }
}

export function getDriverStatusTone(status: DriverVerificationStatus): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case DriverVerificationStatus.Approved:
      return 'success';
    case DriverVerificationStatus.PendingVerification:
      return 'warning';
    case DriverVerificationStatus.Rejected:
    case DriverVerificationStatus.Suspended:
      return 'danger';
    default:
      return 'neutral';
  }
}

