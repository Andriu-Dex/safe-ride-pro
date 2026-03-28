import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  DriverVerificationStatus,
  MembershipStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import {
  VEHICLES_REPOSITORY,
  VehiclesRepository,
} from '../ports/vehicles.repository';

export type RegisterVehicleCommand = {
  userId: string;
  vehicleType: VehicleType;
  brandId?: string;
  modelId?: string;
  customBrandName?: string;
  customModelName?: string;
  year: number;
  color: string;
  plate: string;
  seatCount: number;
  luggagePolicy: string;
  registrationDocumentFileKey?: string;
};

const MAX_SEAT_COUNT_BY_VEHICLE_TYPE: Record<VehicleType, number> = {
  [VehicleType.Motorcycle]: 1,
  [VehicleType.Car]: 4,
  [VehicleType.PickupTruck]: 5,
};

@Injectable()
export class RegisterVehicleUseCase {
  constructor(
    @Inject(VEHICLES_REPOSITORY)
    private readonly vehiclesRepository: VehiclesRepository,
  ) {}

  async execute(command: RegisterVehicleCommand) {
    const membership = await this.vehiclesRepository.findDefaultMembershipByUserId(command.userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para registrar vehiculos.');
    }

    if (
      membership.driverVerificationStatus !== DriverVerificationStatus.PendingVerification &&
      membership.driverVerificationStatus !== DriverVerificationStatus.Approved
    ) {
      throw new ForbiddenException(
        'Debes haber iniciado o aprobado tu proceso de conductor para registrar vehiculos.',
      );
    }

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
      throw new BadRequestException('Debes elegir una marca del catalogo o ingresar una marca manual, no ambas.');
    }

    if (!command.brandId && !command.customBrandName?.trim()) {
      throw new BadRequestException('Debes seleccionar una marca o ingresar una marca manual.');
    }

    if (command.modelId && command.customModelName?.trim()) {
      throw new BadRequestException('Debes elegir un modelo del catalogo o ingresar un modelo manual, no ambos.');
    }

    if (!command.modelId && !command.customModelName?.trim()) {
      throw new BadRequestException('Debes seleccionar un modelo o ingresar un modelo manual.');
    }

    if (command.brandId) {
      const brand = await this.vehiclesRepository.findVehicleBrandById(command.brandId);

      if (!brand) {
        throw new BadRequestException('La marca seleccionada no existe o no se encuentra activa.');
      }
    }

    if (command.modelId) {
      const model = await this.vehiclesRepository.findVehicleModelById(command.modelId);

      if (!model) {
        throw new BadRequestException('El modelo seleccionado no existe o no se encuentra activo.');
      }

      if (command.brandId && model.brandId !== command.brandId) {
        throw new BadRequestException('El modelo seleccionado no pertenece a la marca indicada.');
      }

      if (model.vehicleType !== command.vehicleType) {
        throw new BadRequestException('El modelo seleccionado no corresponde al tipo de vehiculo elegido.');
      }
    }

    const normalizedPlate = command.plate.trim().toUpperCase();
    const existingVehicle = await this.vehiclesRepository.findVehicleByPlate(normalizedPlate);

    if (existingVehicle) {
      throw new BadRequestException('La placa ingresada ya esta registrada en el sistema.');
    }

    const vehicle = await this.vehiclesRepository.createVehicle({
      membershipId: membership.id,
      vehicleType: command.vehicleType,
      brandId: command.brandId,
      modelId: command.modelId,
      customBrandName: command.customBrandName?.trim() || undefined,
      customModelName: command.customModelName?.trim() || undefined,
      year: command.year,
      color: command.color.trim(),
      plate: normalizedPlate,
      seatCount: command.seatCount,
      luggagePolicy: command.luggagePolicy as never,
      registrationDocumentFileKey: command.registrationDocumentFileKey?.trim() || undefined,
    });

    return {
      message: 'Vehiculo registrado correctamente.',
      vehicle,
    };
  }
}