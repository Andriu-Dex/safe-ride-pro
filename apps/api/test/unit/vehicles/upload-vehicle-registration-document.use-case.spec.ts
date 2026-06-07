import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  MembershipStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import type { VehicleDocumentStorageService } from '../../../src/modules/vehicles/application/ports/vehicle-document-storage.service';
import type { VehiclesRepository } from '../../../src/modules/vehicles/application/ports/vehicles.repository';
import { UploadVehicleRegistrationDocumentUseCase } from '../../../src/modules/vehicles/application/use-cases/upload-vehicle-registration-document.use-case';

function createVehiclesRepositoryMock(): jest.Mocked<VehiclesRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    listLicenseTypes: jest.fn(),
    listVehicleBrands: jest.fn(),
    listVehicleModels: jest.fn(),
    findVehicleBrandById: jest.fn(),
    findVehicleModelById: jest.fn(),
    findVehicleByPlate: jest.fn(),
    findVehicleByIdForMembership: jest.fn(),
    findVehiclesByMembershipId: jest.fn(),
    createVehicle: jest.fn(),
    updateVehicle: jest.fn(),
    updateVehicleStatus: jest.fn(),
  };
}

function createVehicleDocumentStorageMock(): jest.Mocked<VehicleDocumentStorageService> {
  return {
    storeRegistrationDocument: jest.fn(),
    readRegistrationDocument: jest.fn(),
  };
}

describe('UploadVehicleRegistrationDocumentUseCase', () => {
  it('rejects unsupported mime types', async () => {
    const repository = createVehiclesRepositoryMock();
    const storage = createVehicleDocumentStorageMock();
    const useCase = new UploadVehicleRegistrationDocumentUseCase(repository, storage);

    await expect(
      useCase.execute('user-1', {
        originalname: 'document.txt',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('hello'),
      }),
    ).rejects.toThrow(
      new BadRequestException('El documento debe estar en formato PDF, JPG, PNG o WEBP.'),
    );
  });

  it('blocks uploads when the approved driver has an expired license', async () => {
    const repository = createVehiclesRepositoryMock();
    const storage = createVehicleDocumentStorageMock();
    const useCase = new UploadVehicleRegistrationDocumentUseCase(repository, storage);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
      licenseStatus: DriverLicenseStatus.Expired,
      licenseExpiresAt: new Date('2020-01-01T10:00:00.000Z'),
      licenseExpiresInDays: -1,
    });

    await expect(
      useCase.execute('user-1', {
        originalname: 'registration.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('content'),
      }),
    ).rejects.toThrow(
      new ForbiddenException(
        'Tu licencia vencio. Debes actualizarla antes de gestionar vehiculos.',
      ),
    );
  });

  it('stores the registration document for an allowed membership', async () => {
    const repository = createVehiclesRepositoryMock();
    const storage = createVehicleDocumentStorageMock();
    const useCase = new UploadVehicleRegistrationDocumentUseCase(repository, storage);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.PendingVerification,
    });
    storage.storeRegistrationDocument.mockResolvedValue({
      fileKey: 'membership-1/registration/file-1.pdf',
    });

    const response = await useCase.execute('user-1', {
      originalname: 'matricula.pdf',
      mimetype: 'application/pdf',
      size: 2048,
      buffer: Buffer.from('pdf-content'),
    });

    expect(response.message).toBe('El documento de matricula se cargo correctamente.');
    expect(storage.storeRegistrationDocument).toHaveBeenCalledWith({
      membershipId: 'membership-1',
      fileName: 'matricula.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('pdf-content'),
    });
    expect(response.fileKey).toBe('membership-1/registration/file-1.pdf');
  });

  it('rejects uploads when no file is provided', async () => {
    const repository = createVehiclesRepositoryMock();
    const storage = createVehicleDocumentStorageMock();
    const useCase = new UploadVehicleRegistrationDocumentUseCase(repository, storage);

    await expect(
      useCase.execute('user-1', undefined),
    ).rejects.toThrow(
      new BadRequestException('Selecciona un archivo antes de continuar.'),
    );
  });

  it('rejects uploads when file size exceeds the limit', async () => {
    const repository = createVehiclesRepositoryMock();
    const storage = createVehicleDocumentStorageMock();
    const useCase = new UploadVehicleRegistrationDocumentUseCase(repository, storage);

    const oversizedFile = {
      originalname: 'document.pdf',
      mimetype: 'application/pdf',
      size: 9 * 1024 * 1024, // 9 MB
      buffer: Buffer.from('large-content'),
    };

    await expect(
      useCase.execute('user-1', oversizedFile),
    ).rejects.toThrow(
      new BadRequestException('El documento no puede superar los 8 MB.'),
    );
  });

  it('stores the document with default filename if originalname is falsy', async () => {
    const repository = createVehiclesRepositoryMock();
    const storage = createVehicleDocumentStorageMock();
    const useCase = new UploadVehicleRegistrationDocumentUseCase(repository, storage);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.PendingVerification,
    });
    storage.storeRegistrationDocument.mockResolvedValue({
      fileKey: 'membership-1/registration/default.pdf',
    });

    const response = await useCase.execute('user-1', {
      originalname: '',
      mimetype: 'application/pdf',
      size: 2048,
      buffer: Buffer.from('pdf-content'),
    });

    expect(response.message).toBe('El documento de matricula se cargo correctamente.');
    expect(storage.storeRegistrationDocument).toHaveBeenCalledWith({
      membershipId: 'membership-1',
      fileName: 'vehicle-registration-document',
      mimeType: 'application/pdf',
      content: Buffer.from('pdf-content'),
    });
    expect(response.fileKey).toBe('membership-1/registration/default.pdf');
  });
});
