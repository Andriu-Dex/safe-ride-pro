import {
  DRIVER_LICENSE_EXPIRING_SOON_DAYS,
  DriverLicenseStatus,
  DriverVerificationStatus,
} from '@saferidepro/shared-types';

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

export function getDriverLicenseStatusLabel(status?: DriverLicenseStatus): string {
  switch (status) {
    case DriverLicenseStatus.Valid:
      return 'Licencia vigente';
    case DriverLicenseStatus.ExpiringSoon:
      return 'Licencia por vencer';
    case DriverLicenseStatus.Expired:
      return 'Licencia vencida';
    case DriverLicenseStatus.Missing:
      return 'Sin licencia registrada';
    default:
      return 'Sin informacion';
  }
}

export function getDriverLicenseStatusTone(
  status?: DriverLicenseStatus,
): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case DriverLicenseStatus.Valid:
      return 'success';
    case DriverLicenseStatus.ExpiringSoon:
      return 'warning';
    case DriverLicenseStatus.Expired:
      return 'danger';
    case DriverLicenseStatus.Missing:
    default:
      return 'neutral';
  }
}

export function getDriverLicenseAlertMessage(
  status?: DriverLicenseStatus,
  expiresInDays?: number | null,
): string | null {
  switch (status) {
    case DriverLicenseStatus.Expired:
      return 'Tu licencia vencio. Debes actualizarla para volver a registrar vehiculos, publicar o iniciar viajes.';
    case DriverLicenseStatus.ExpiringSoon:
      return expiresInDays === 0
        ? 'Tu licencia vence hoy. Renovarla a tiempo evitara bloqueos operativos automaticos.'
        : `Tu licencia vence en ${expiresInDays} dias. Renovarla antes de ${DRIVER_LICENSE_EXPIRING_SOON_DAYS} dias evita bloqueos de operacion.`;
    case DriverLicenseStatus.Missing:
      return 'Aun no existe una licencia registrada para tu perfil de conductor.';
    default:
      return null;
  }
}

