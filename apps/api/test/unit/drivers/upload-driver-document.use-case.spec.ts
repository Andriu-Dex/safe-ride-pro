import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  DriverVerificationStatus,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import type {
  DriverDocumentStorageService,
  StoredDriverDocument,
} from '../../../src/modules/drivers/application/ports/driver-document-storage.service';
import type {
  DriverMembershipRecord,
  DriversRepository,
} from '../../../src/modules/drivers/application/ports/drivers.repository';
import { DriverDocumentType } from '../../../src/modules/drivers/application/ports/drivers.repository';
import { UploadDriverDocumentUseCase } from '../../../src/modules/drivers/application/use-cases/upload-driver-document.use-case';

type UploadedDriverDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

function createDriversRepositoryMock(): jest.Mocked<DriversRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findMembershipById: jest.fn(),
    listInstitutionAdminMembershipIds: jest.fn(),
    findDriverProfileByMembershipId: jest.fn(),
    listReviewableDriverApplications: jest.fn(),
    submitDriverApplication: jest.fn(),
    reviewDriverApplication: jest.fn(),
  };
}

function createStorageServiceMock(): jest.Mocked<DriverDocumentStorageService> {
  return {
    storeDocument: jest.fn(),
    readDocument: jest.fn(),
  };
}

function buildMembership(
  overrides: Partial<DriverMembershipRecord> = {},
): DriverMembershipRecord {
  return {
    id: 'membership-1',
    userId: 'user-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    role: InstitutionMembershipRole.Student,
    membershipStatus: MembershipStatus.Active,
    studentCode: 'STUDENT-001',
    isDefault: true,
    driverVerificationStatus: DriverVerificationStatus.NotRequested,
    ...overrides,
  };
}

function buildFile(
  overrides: Partial<UploadedDriverDocumentFile> = {},
): UploadedDriverDocumentFile {
  return {
    originalname: 'cedula.pdf',
    mimetype: 'application/pdf',
    size: 128,
    buffer: Buffer.from('file-content'),
    ...overrides,
  };
}

describe('UploadDriverDocumentUseCase', () => {
  it('requires a file before continuing', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createStorageServiceMock();
    const useCase = new UploadDriverDocumentUseCase(repository, storageService);

    await expect(
      useCase.execute('user-1', DriverDocumentType.Identity, undefined),
    ).rejects.toThrow(
      new BadRequestException('Selecciona un archivo antes de continuar.'),
    );

    expect(repository.findDefaultMembershipByUserId).not.toHaveBeenCalled();
  });

  it('rejects unsupported mime types', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createStorageServiceMock();
    const useCase = new UploadDriverDocumentUseCase(repository, storageService);

    await expect(
      useCase.execute(
        'user-1',
        DriverDocumentType.Identity,
        buildFile({
          mimetype: 'text/plain',
        }),
      ),
    ).rejects.toThrow(
      new BadRequestException('El documento debe estar en formato PDF, JPG, PNG o WEBP.'),
    );

    expect(repository.findDefaultMembershipByUserId).not.toHaveBeenCalled();
  });

  it('rejects documents larger than 8 MB', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createStorageServiceMock();
    const useCase = new UploadDriverDocumentUseCase(repository, storageService);

    await expect(
      useCase.execute(
        'user-1',
        DriverDocumentType.Identity,
        buildFile({
          size: 8 * 1024 * 1024 + 1,
        }),
      ),
    ).rejects.toThrow(
      new BadRequestException('El documento no puede superar los 8 MB.'),
    );

    expect(repository.findDefaultMembershipByUserId).not.toHaveBeenCalled();
  });

  it('requires an active institutional membership', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createStorageServiceMock();
    const useCase = new UploadDriverDocumentUseCase(repository, storageService);

    repository.findDefaultMembershipByUserId.mockResolvedValue(
      buildMembership({
        membershipStatus: MembershipStatus.Suspended,
      }),
    );

    await expect(
      useCase.execute('user-1', DriverDocumentType.Identity, buildFile()),
    ).rejects.toThrow(
      new ForbiddenException(
        'No tienes una membresia activa para cargar documentos de conductor.',
      ),
    );
  });

  it('blocks institutional admins from uploading driver documents', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createStorageServiceMock();
    const useCase = new UploadDriverDocumentUseCase(repository, storageService);

    repository.findDefaultMembershipByUserId.mockResolvedValue(
      buildMembership({
        role: InstitutionMembershipRole.InstitutionAdmin,
      }),
    );

    await expect(
      useCase.execute('user-1', DriverDocumentType.Identity, buildFile()),
    ).rejects.toThrow(
      new ForbiddenException(
        'La membresia administrativa no puede cargar documentos para habilitacion como conductor.',
      ),
    );
  });

  it('blocks uploads when the driver profile is already approved', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createStorageServiceMock();
    const useCase = new UploadDriverDocumentUseCase(repository, storageService);

    repository.findDefaultMembershipByUserId.mockResolvedValue(
      buildMembership({
        effectiveDriverVerificationStatus: DriverVerificationStatus.Approved,
      }),
    );

    await expect(
      useCase.execute('user-1', DriverDocumentType.License, buildFile()),
    ).rejects.toThrow(
      new ForbiddenException(
        'Tu perfil de conductor ya fue aprobado. Si necesitas actualizar documentos, contacta a administracion.',
      ),
    );
  });

  it('stores the identity document and returns the generated key', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createStorageServiceMock();
    const useCase = new UploadDriverDocumentUseCase(repository, storageService);
    const storedDocument: StoredDriverDocument = {
      fileKey: 'identity-file-key',
    };

    repository.findDefaultMembershipByUserId.mockResolvedValue(buildMembership());
    storageService.storeDocument.mockResolvedValue(storedDocument);

    const response = await useCase.execute(
      'user-1',
      DriverDocumentType.Identity,
      buildFile({
        originalname: 'cedula-frontal.webp',
        mimetype: 'image/webp',
      }),
    );

    expect(storageService.storeDocument).toHaveBeenCalledWith({
      membershipId: 'membership-1',
      documentType: DriverDocumentType.Identity,
      fileName: 'cedula-frontal.webp',
      mimeType: 'image/webp',
      content: Buffer.from('file-content'),
    });
    expect(response).toEqual({
      message: 'El documento de identidad se cargo correctamente.',
      documentType: DriverDocumentType.Identity,
      fileKey: 'identity-file-key',
    });
  });

  it('uses a fallback file name when the original name is empty', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createStorageServiceMock();
    const useCase = new UploadDriverDocumentUseCase(repository, storageService);

    repository.findDefaultMembershipByUserId.mockResolvedValue(buildMembership());
    storageService.storeDocument.mockResolvedValue({
      fileKey: 'license-file-key',
    });

    const response = await useCase.execute(
      'user-1',
      DriverDocumentType.License,
      buildFile({
        originalname: '',
        mimetype: 'image/png',
      }),
    );

    expect(storageService.storeDocument).toHaveBeenCalledWith({
      membershipId: 'membership-1',
      documentType: DriverDocumentType.License,
      fileName: 'license-document',
      mimeType: 'image/png',
      content: Buffer.from('file-content'),
    });
    expect(response.message).toBe('El documento de licencia se cargo correctamente.');
  });
});
