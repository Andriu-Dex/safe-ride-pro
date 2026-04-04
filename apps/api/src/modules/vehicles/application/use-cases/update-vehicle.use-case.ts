import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LuggagePolicy, VehicleType } from '@saferidepro/shared-types';

import {
  VEHICLES_REPOSITORY,
  VehiclesRepository,
} from '../ports/vehicles.repository';
import {
  assertVehicleManagementAllowed,
  validateAndNormalizeVehicleCommand,
} from '../services/vehicle-command-validator';

export type UpdateVehicleCommand = {
  userId: string;
  vehicleId: string;
  vehicleType: VehicleType;
  brandId?: string;
  modelId?: string;
  customBrandName?: string;
  customModelName?: string;
  year: number;
  color: string;
  plate: string;
  seatCount: number;
  luggagePolicy: LuggagePolicy;
  registrationDocumentFileKey?: string;
};

@Injectable()
export class UpdateVehicleUseCase {
  constructor(
    @Inject(VEHICLES_REPOSITORY)
    private readonly vehiclesRepository: VehiclesRepository,
  ) {}

  async execute(command: UpdateVehicleCommand) {
    const membership = await assertVehicleManagementAllowed(
      await this.vehiclesRepository.findDefaultMembershipByUserId(command.userId),
    );

    const currentVehicle = await this.vehiclesRepository.findVehicleByIdForMembership(
      membership.id,
      command.vehicleId,
    );

    if (!currentVehicle) {
      throw new NotFoundException('El vehiculo solicitado no existe.');
    }

    if (currentVehicle.operationalTripCount > 0) {
      throw new BadRequestException(
        'No puedes editar un vehiculo con viajes publicados, llenos o en curso.',
      );
    }

    const normalizedCommand = await validateAndNormalizeVehicleCommand(
      this.vehiclesRepository,
      membership.id,
      {
        vehicleType: command.vehicleType,
        brandId: command.brandId,
        modelId: command.modelId,
        customBrandName: command.customBrandName,
        customModelName: command.customModelName,
        year: command.year,
        color: command.color,
        plate: command.plate,
        seatCount: command.seatCount,
        luggagePolicy: command.luggagePolicy,
        registrationDocumentFileKey: command.registrationDocumentFileKey,
      },
      currentVehicle.id,
    );

    const vehicle = await this.vehiclesRepository.updateVehicle(normalizedCommand);

    return {
      message: 'Vehiculo actualizado correctamente.',
      vehicle,
    };
  }
}
