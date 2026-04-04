import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  MembershipStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import type {
  CreateVehicleInput,
  UpdateVehicleInput,
  VehicleMembershipRecord,
  VehiclesRepository,
} from '../ports/vehicles.repository';

type BaseVehicleCommand = Omit<CreateVehicleInput, 'membershipId'>;

export const MAX_SEAT_COUNT_BY_VEHICLE_TYPE: Record<VehicleType, number> = {
  [VehicleType.Motorcycle]: 1,
  [VehicleType.Car]: 4,
  [VehicleType.PickupTruck]: 5,
};

export async function assertVehicleManagementAllowed(
  membership: VehicleMembershipRecord | null,
) {
  if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
    throw new ForbiddenException('No tienes una membresia activa para gestionar vehiculos.');
  }

  if (
    membership.driverVerificationStatus !== DriverVerificationStatus.PendingVerification &&
    membership.driverVerificationStatus !== DriverVerificationStatus.Approved
  ) {
    throw new ForbiddenException(
      'Debes haber iniciado o aprobado tu proceso de conductor para gestionar vehiculos.',
    );
  }

  if (
    membership.driverVerificationStatus === DriverVerificationStatus.Approved &&
    membership.licenseStatus === DriverLicenseStatus.Expired
  ) {
    throw new ForbiddenException(
      'Tu licencia vencio. Debes actualizarla antes de gestionar vehiculos.',
    );
  }

  return membership;
}

export async function validateAndNormalizeVehicleCommand(
  repository: VehiclesRepository,
  membershipId: string,
  command: BaseVehicleCommand,
): Promise<CreateVehicleInput>;
export async function validateAndNormalizeVehicleCommand(
  repository: VehiclesRepository,
  membershipId: string,
  command: BaseVehicleCommand,
  currentVehicleId: string,
): Promise<UpdateVehicleInput>;
export async function validateAndNormalizeVehicleCommand(
  repository: VehiclesRepository,
  membershipId: string,
  command: BaseVehicleCommand,
  currentVehicleId?: string,
): Promise<CreateVehicleInput | UpdateVehicleInput> {
  const currentYear = new Date().getFullYear();

  if (command.year < 1980 || command.year > currentYear + 1) {
    throw new BadRequestException('El anio del vehiculo no es valido.');
  }

  const maxSeatCount = MAX_SEAT_COUNT_BY_VEHICLE_TYPE[command.vehicleType];

  if (command.seatCount < 1 || command.seatCount > maxSeatCount) {
    throw new BadRequestException(
      `La capacidad permitida para este tipo de vehiculo es de 1 a ${maxSeatCount} pasajeros.`,
    );
  }

  if (command.vehicleType === VehicleType.Motorcycle && command.seatCount !== 1) {
    throw new BadRequestException('Las motocicletas solo pueden registrarse con 1 pasajero.');
  }

  if (command.brandId && command.customBrandName?.trim()) {
    throw new BadRequestException(
      'Debes elegir una marca del catalogo o ingresar una marca manual, no ambas.',
    );
  }

  if (!command.brandId && !command.customBrandName?.trim()) {
    throw new BadRequestException('Debes seleccionar una marca o ingresar una marca manual.');
  }

  if (command.modelId && command.customModelName?.trim()) {
    throw new BadRequestException(
      'Debes elegir un modelo del catalogo o ingresar un modelo manual, no ambos.',
    );
  }

  if (!command.modelId && !command.customModelName?.trim()) {
    throw new BadRequestException('Debes seleccionar un modelo o ingresar un modelo manual.');
  }

  if (!command.registrationDocumentFileKey?.trim()) {
    throw new BadRequestException(
      'Debes cargar el documento de matricula del vehiculo.',
    );
  }

  if (command.brandId) {
    const brand = await repository.findVehicleBrandById(command.brandId);

    if (!brand) {
      throw new BadRequestException(
        'La marca seleccionada no existe o no se encuentra activa.',
      );
    }
  }

  if (command.modelId) {
    const model = await repository.findVehicleModelById(command.modelId);

    if (!model) {
      throw new BadRequestException(
        'El modelo seleccionado no existe o no se encuentra activo.',
      );
    }

    if (command.brandId && model.brandId !== command.brandId) {
      throw new BadRequestException(
        'El modelo seleccionado no pertenece a la marca indicada.',
      );
    }

    if (model.vehicleType !== command.vehicleType) {
      throw new BadRequestException(
        'El modelo seleccionado no corresponde al tipo de vehiculo elegido.',
      );
    }
  }

  const normalizedPlate = command.plate.trim().toUpperCase();
  const existingVehicle = await repository.findVehicleByPlate(normalizedPlate);

  if (existingVehicle && existingVehicle.id !== currentVehicleId) {
    throw new BadRequestException('La placa ingresada ya esta registrada en el sistema.');
  }

  const normalizedInput: CreateVehicleInput = {
    membershipId,
    vehicleType: command.vehicleType,
    brandId: command.brandId,
    modelId: command.modelId,
    customBrandName: command.customBrandName?.trim() || undefined,
    customModelName: command.customModelName?.trim() || undefined,
    year: command.year,
    color: command.color.trim(),
    plate: normalizedPlate,
    seatCount: command.seatCount,
    luggagePolicy: command.luggagePolicy,
    registrationDocumentFileKey: command.registrationDocumentFileKey.trim(),
  };

  if (!currentVehicleId) {
    return normalizedInput;
  }

  return {
    ...normalizedInput,
    vehicleId: currentVehicleId,
  };
}
