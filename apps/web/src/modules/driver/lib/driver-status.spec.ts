import { DriverLicenseStatus, DriverVerificationStatus } from '@saferidepro/shared-types';
import { describe, expect, it } from 'vitest';

import {
  getDriverLicenseAlertMessage,
  getDriverLicenseStatusLabel,
  getDriverLicenseStatusTone,
  getDriverStatusLabel,
  getDriverStatusTone,
} from './driver-status';

describe('driver-status', () => {
  it('maps driver verification labels and tones', () => {
    expect(getDriverStatusLabel(DriverVerificationStatus.NotRequested)).toBe('No solicitado');
    expect(getDriverStatusLabel(DriverVerificationStatus.PendingVerification)).toBe(
      'Pendiente de revision',
    );
    expect(getDriverStatusLabel(DriverVerificationStatus.Approved)).toBe('Aprobado');
    expect(getDriverStatusLabel(DriverVerificationStatus.Rejected)).toBe('Rechazado');
    expect(getDriverStatusLabel(DriverVerificationStatus.Suspended)).toBe('Suspendido');

    expect(getDriverStatusTone(DriverVerificationStatus.Approved)).toBe('success');
    expect(getDriverStatusTone(DriverVerificationStatus.PendingVerification)).toBe('warning');
    expect(getDriverStatusTone(DriverVerificationStatus.Rejected)).toBe('danger');
    expect(getDriverStatusTone(DriverVerificationStatus.NotRequested)).toBe('neutral');
  });

  it('maps license labels, tones and operational alerts', () => {
    expect(getDriverLicenseStatusLabel(DriverLicenseStatus.Valid)).toBe('Licencia vigente');
    expect(getDriverLicenseStatusLabel(DriverLicenseStatus.ExpiringSoon)).toBe(
      'Licencia por vencer',
    );
    expect(getDriverLicenseStatusLabel(DriverLicenseStatus.Expired)).toBe('Licencia vencida');
    expect(getDriverLicenseStatusLabel(DriverLicenseStatus.Missing)).toBe(
      'Sin licencia registrada',
    );

    expect(getDriverLicenseStatusTone(DriverLicenseStatus.Valid)).toBe('success');
    expect(getDriverLicenseStatusTone(DriverLicenseStatus.ExpiringSoon)).toBe('warning');
    expect(getDriverLicenseStatusTone(DriverLicenseStatus.Expired)).toBe('danger');
    expect(getDriverLicenseStatusTone(DriverLicenseStatus.Missing)).toBe('neutral');

    expect(getDriverLicenseAlertMessage(DriverLicenseStatus.Valid)).toBeNull();
    expect(getDriverLicenseAlertMessage(DriverLicenseStatus.Expired)).toContain(
      'Tu licencia vencio',
    );
    expect(getDriverLicenseAlertMessage(DriverLicenseStatus.ExpiringSoon, 0)).toContain(
      'vence hoy',
    );
    expect(getDriverLicenseAlertMessage(DriverLicenseStatus.ExpiringSoon, 5)).toContain(
      'vence en 5 dias',
    );
    expect(getDriverLicenseAlertMessage(DriverLicenseStatus.Missing)).toContain(
      'Aun no existe',
    );
  });

  it('maps unknown/default driver and license statuses', () => {
    expect(getDriverStatusLabel('UNKNOWN_STATUS' as any)).toBe('UNKNOWN_STATUS');
    expect(getDriverStatusTone('UNKNOWN_STATUS' as any)).toBe('neutral');
    expect(getDriverLicenseStatusLabel('UNKNOWN_STATUS' as any)).toBe('Sin informacion');
    expect(getDriverLicenseStatusLabel(undefined)).toBe('Sin informacion');
    expect(getDriverLicenseStatusTone('UNKNOWN_STATUS' as any)).toBe('neutral');
    expect(getDriverLicenseStatusTone(undefined)).toBe('neutral');
  });
});
