import {
  DriverVerificationStatus,
  LuggagePolicy,
  VehicleType,
} from '@saferidepro/shared-types';

export function getVehicleTypeLabel(vehicleType: VehicleType): string {
  switch (vehicleType) {
    case VehicleType.Motorcycle:
      return 'Motocicleta';
    case VehicleType.Car:
      return 'Auto';
    case VehicleType.PickupTruck:
      return 'Camioneta';
    default:
      return vehicleType;
  }
}

export function getLuggagePolicyLabel(luggagePolicy: LuggagePolicy): string {
  switch (luggagePolicy) {
    case LuggagePolicy.NotAllowed:
      return 'No permitido';
    case LuggagePolicy.SmallOnly:
      return 'Solo pequeno';
    case LuggagePolicy.UpToMedium:
      return 'Hasta mediano';
    case LuggagePolicy.LargeAllowed:
      return 'Grande permitido';
    default:
      return luggagePolicy;
  }
}

export function canRegisterVehicles(status: DriverVerificationStatus): boolean {
  return (
    status === DriverVerificationStatus.PendingVerification ||
    status === DriverVerificationStatus.Approved
  );
}

