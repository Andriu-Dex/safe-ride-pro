import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  VEHICLES_REPOSITORY,
  VehiclesRepository,
} from '../ports/vehicles.repository';
import { assertVehicleManagementAllowed } from '../services/vehicle-command-validator';

export type SetVehicleActiveStatusCommand = {
  userId: string;
  vehicleId: string;
  isActive: boolean;
};

@Injectable()
export class SetVehicleActiveStatusUseCase {
  constructor(
    @Inject(VEHICLES_REPOSITORY)
    private readonly vehiclesRepository: VehiclesRepository,
  ) {}

  async execute(command: SetVehicleActiveStatusCommand) {
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

    if (currentVehicle.isActive === command.isActive) {
      throw new BadRequestException(
        command.isActive
          ? 'El vehiculo ya se encuentra activo.'
          : 'El vehiculo ya se encuentra inactivo.',
      );
    }

    if (!command.isActive && currentVehicle.operationalTripCount > 0) {
      throw new BadRequestException(
        'No puedes desactivar un vehiculo con viajes publicados, llenos o en curso.',
      );
    }

    const vehicle = await this.vehiclesRepository.updateVehicleStatus(
      command.vehicleId,
      command.isActive,
    );

    return {
      message: command.isActive
        ? 'Vehiculo activado correctamente.'
        : 'Vehiculo desactivado correctamente.',
      vehicle,
    };
  }
}
