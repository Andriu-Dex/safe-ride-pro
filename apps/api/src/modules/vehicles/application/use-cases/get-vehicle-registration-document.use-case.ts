import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';

import {
  VEHICLE_DOCUMENT_STORAGE_SERVICE,
  VehicleDocumentStorageService,
} from '../ports/vehicle-document-storage.service';
import {
  VEHICLES_REPOSITORY,
  VehiclesRepository,
} from '../ports/vehicles.repository';

@Injectable()
export class GetVehicleRegistrationDocumentUseCase {
  constructor(
    @Inject(VEHICLES_REPOSITORY)
    private readonly vehiclesRepository: VehiclesRepository,
    @Inject(VEHICLE_DOCUMENT_STORAGE_SERVICE)
    private readonly vehicleDocumentStorageService: VehicleDocumentStorageService,
  ) {}

  async execute(userId: string, vehicleId: string) {
    const membership =
      await this.vehiclesRepository.findDefaultMembershipByUserId(userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException(
        'No tienes una membresia activa para revisar documentos del vehiculo.',
      );
    }

    const vehicle = await this.vehiclesRepository.findVehicleByIdForMembership(
      membership.id,
      vehicleId,
    );

    if (!vehicle) {
      throw new NotFoundException('El vehiculo solicitado no existe.');
    }

    if (!vehicle.registrationDocumentFileKey) {
      throw new NotFoundException(
        'El vehiculo no tiene un documento de matricula registrado.',
      );
    }

    return this.vehicleDocumentStorageService.readRegistrationDocument(
      vehicle.registrationDocumentFileKey,
    );
  }
}
