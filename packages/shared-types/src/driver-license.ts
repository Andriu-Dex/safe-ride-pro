export enum DriverLicenseStatus {
  Missing = 'MISSING',
  Valid = 'VALID',
  ExpiringSoon = 'EXPIRING_SOON',
  Expired = 'EXPIRED',
}

export type DriverVerificationStatusLike =
  | 'NOT_REQUESTED'
  | 'PENDING_VERIFICATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';

export const DRIVER_LICENSE_EXPIRING_SOON_DAYS = 30;

function normalizeLicenseDate(value?: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  const normalizedDate = value instanceof Date ? value : new Date(value);

  return Number.isNaN(normalizedDate.getTime()) ? null : normalizedDate;
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function getDaysUntilDriverLicenseExpiration(
  licenseExpiresAt?: Date | string | null,
  now: Date = new Date(),
): number | null {
  const normalizedLicenseDate = normalizeLicenseDate(licenseExpiresAt);

  if (!normalizedLicenseDate) {
    return null;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const diffInMilliseconds =
    startOfDay(normalizedLicenseDate).getTime() - startOfDay(now).getTime();

  return Math.floor(diffInMilliseconds / millisecondsPerDay);
}

export function getDriverLicenseStatus(
  licenseExpiresAt?: Date | string | null,
  now: Date = new Date(),
): DriverLicenseStatus {
  const daysUntilExpiration = getDaysUntilDriverLicenseExpiration(licenseExpiresAt, now);

  if (daysUntilExpiration === null) {
    return DriverLicenseStatus.Missing;
  }

  if (daysUntilExpiration < 0) {
    return DriverLicenseStatus.Expired;
  }

  if (daysUntilExpiration <= DRIVER_LICENSE_EXPIRING_SOON_DAYS) {
    return DriverLicenseStatus.ExpiringSoon;
  }

  return DriverLicenseStatus.Valid;
}

export function getEffectiveDriverVerificationStatus(
  driverVerificationStatus: DriverVerificationStatusLike,
  licenseExpiresAt?: Date | string | null,
  now: Date = new Date(),
): DriverVerificationStatusLike {
  if (
    driverVerificationStatus === 'APPROVED' &&
    getDriverLicenseStatus(licenseExpiresAt, now) === DriverLicenseStatus.Expired
  ) {
    return 'SUSPENDED';
  }

  return driverVerificationStatus;
}

export function isDriverBlockedByExpiredLicense(
  driverVerificationStatus: DriverVerificationStatusLike,
  licenseExpiresAt?: Date | string | null,
  now: Date = new Date(),
): boolean {
  return (
    driverVerificationStatus === 'APPROVED' &&
    getDriverLicenseStatus(licenseExpiresAt, now) === DriverLicenseStatus.Expired
  );
}
