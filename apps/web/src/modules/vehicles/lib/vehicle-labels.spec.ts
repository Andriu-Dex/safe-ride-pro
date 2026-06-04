import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  LuggagePolicy,
  VehicleType,
} from '@saferidepro/shared-types';
import { describe, expect, it } from 'vitest';

import {
  canRegisterVehicles,
  getLuggagePolicyLabel,
  getVehicleTypeLabel,
} from './vehicle-labels';

describe('vehicle-labels', () => {
  it('maps vehicle type and luggage policy labels for the UI', () => {
    expect(getVehicleTypeLabel(VehicleType.Car)).toBe('Auto');
    expect(getVehicleTypeLabel(VehicleType.Motorcycle)).toBe('Motocicleta');
    expect(getVehicleTypeLabel(VehicleType.PickupTruck)).toBe('Camioneta');

    expect(getLuggagePolicyLabel(LuggagePolicy.NotAllowed)).toBe('No permitido');
    expect(getLuggagePolicyLabel(LuggagePolicy.SmallOnly)).toBe('Solo pequeno');
    expect(getLuggagePolicyLabel(LuggagePolicy.UpToMedium)).toBe('Hasta mediano');
    expect(getLuggagePolicyLabel(LuggagePolicy.LargeAllowed)).toBe('Grande permitido');
  });

  it('allows vehicle registration only for valid driver contexts', () => {
    expect(
      canRegisterVehicles(
        DriverVerificationStatus.PendingVerification,
        DriverLicenseStatus.Missing,
      ),
    ).toBe(true);
    expect(
      canRegisterVehicles(DriverVerificationStatus.Approved, DriverLicenseStatus.Valid),
    ).toBe(true);
    expect(
      canRegisterVehicles(DriverVerificationStatus.Approved, DriverLicenseStatus.Expired),
    ).toBe(false);
    expect(
      canRegisterVehicles(DriverVerificationStatus.Rejected, DriverLicenseStatus.Valid),
    ).toBe(false);
  });
});
