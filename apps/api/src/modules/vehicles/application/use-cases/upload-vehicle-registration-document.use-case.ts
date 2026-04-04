import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';

import {
  VEHICLE_DOCUMENT_STORAGE_SERVICE,
  VehicleDocumentStorageService,
} from '../ports/vehicle-document-storage.service';
import {
  VEHICLES_REPOSITORY,
  VehiclesRepository,
} from '../ports/vehicles.repository';
import { assertVehicleManagementAllowed } from '../services/vehicle-command-validator';

type UploadedVehicleDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const MAX_VEHICLE_DOCUMENT_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_VEHICLE_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class UploadVehicleRegistrationDocumentUseCase {
  constructor(
    @Inject(VEHICLES_REPOSITORY)
    private readonly vehiclesRepository: VehiclesRepository,
    @Inject(VEHICLE_DOCUMENT_STORAGE_SERVICE)
    private readonly vehicleDocumentStorageService: VehicleDocumentStorageService,
  ) {}

  async execute(userId: string, file: UploadedVehicleDocumentFile | undefined) {
    if (!file) {
      throw new BadRequestException('Selecciona un archivo antes de continuar.');
    }

    if (!ALLOWED_VEHICLE_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'El documento debe estar en formato PDF, JPG, PNG o WEBP.',
      );
    }

    if (file.size > MAX_VEHICLE_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException('El documento no puede superar los 8 MB.');
    }

    const membership = await assertVehicleManagementAllowed(
      await this.vehiclesRepository.findDefaultMembershipByUserId(userId),
    );

    const storedDocument =
      await this.vehicleDocumentStorageService.storeRegistrationDocument({
        membershipId: membership.id,
        fileName: file.originalname || 'vehicle-registration-document',
        mimeType: file.mimetype,
        content: file.buffer,
      });

    return {
      message: 'El documento de matricula se cargo correctamente.',
      fileKey: storedDocument.fileKey,
    };
  }
}
