import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';

import {
  DRIVER_DOCUMENT_STORAGE_SERVICE,
  DriverDocumentStorageService,
} from '../ports/driver-document-storage.service';
import {
  DRIVERS_REPOSITORY,
  DriverDocumentType,
  DriversRepository,
} from '../ports/drivers.repository';

type UploadedDriverDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const MAX_DRIVER_DOCUMENT_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_DRIVER_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class UploadDriverDocumentUseCase {
  constructor(
    @Inject(DRIVERS_REPOSITORY)
    private readonly driversRepository: DriversRepository,
    @Inject(DRIVER_DOCUMENT_STORAGE_SERVICE)
    private readonly driverDocumentStorageService: DriverDocumentStorageService,
  ) {}

  async execute(
    userId: string,
    documentType: DriverDocumentType,
    file: UploadedDriverDocumentFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Selecciona un archivo antes de continuar.');
    }

    if (!ALLOWED_DRIVER_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'El documento debe estar en formato PDF, JPG, PNG o WEBP.',
      );
    }

    if (file.size > MAX_DRIVER_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException('El documento no puede superar los 8 MB.');
    }

    const membership =
      await this.driversRepository.findDefaultMembershipByUserId(userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException(
        'No tienes una membresia activa para cargar documentos de conductor.',
      );
    }

    const storedDocument = await this.driverDocumentStorageService.storeDocument({
      membershipId: membership.id,
      documentType,
      fileName: file.originalname || `${documentType}-document`,
      mimeType: file.mimetype,
      content: file.buffer,
    });

    return {
      message:
        documentType === DriverDocumentType.Identity
          ? 'El documento de identidad se cargo correctamente.'
          : 'El documento de licencia se cargo correctamente.',
      documentType,
      fileKey: storedDocument.fileKey,
    };
  }
}
