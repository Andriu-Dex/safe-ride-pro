import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import type {
  RetrievedVehicleDocument,
  VehicleDocumentStorageService,
} from '../../../src/modules/vehicles/application/ports/vehicle-document-storage.service';
import type {
  VehicleMembershipRecord,
  VehicleRecord,
  VehiclesRepository,
} from '../../../src/modules/vehicles/application/ports/vehicles.repository';
import { GetVehicleRegistrationDocumentUseCase } from '../../../src/modules/vehicles/application/use-cases/get-vehicle-registration-document.use-case';

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

function createVehicleDocumentStorageServiceMock(): jest.Mocked<VehicleDocumentStorageService> {
  return {
    readRegistrationDocument: jest.fn(),
    storeRegistrationDocument: jest.fn(),
  };
}

describe('GetVehicleRegistrationDocumentUseCase', () => {
  it('throws ForbiddenException if no active membership is found', async () => {
    const repository = createVehiclesRepositoryMock();
    const storageService = createVehicleDocumentStorageServiceMock();
    repository.findDefaultMembershipByUserId.mockResolvedValue(null);

    const useCase = new GetVehicleRegistrationDocumentUseCase(repository, storageService);

    await expect(useCase.execute('user-1', 'vehicle-1')).rejects.toThrow(
      new ForbiddenException('No tienes una membresia activa para revisar documentos del vehiculo.'),
    );
  });

  it('throws NotFoundException if vehicle is not found', async () => {
    const repository = createVehiclesRepositoryMock();
    const storageService = createVehicleDocumentStorageServiceMock();
    const membership: VehicleMembershipRecord = {
      id: 'membership-1',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    };
    repository.findDefaultMembershipByUserId.mockResolvedValue(membership);
    repository.findVehicleByIdForMembership.mockResolvedValue(null);

    const useCase = new GetVehicleRegistrationDocumentUseCase(repository, storageService);

    await expect(useCase.execute('user-1', 'vehicle-1')).rejects.toThrow(
      new NotFoundException('El vehiculo solicitado no existe.'),
    );
  });

  it('throws NotFoundException if vehicle does not have registration document', async () => {
    const repository = createVehiclesRepositoryMock();
    const storageService = createVehicleDocumentStorageServiceMock();
    const membership: VehicleMembershipRecord = {
      id: 'membership-1',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    };
    const vehicle: VehicleRecord = {
      id: 'vehicle-1',
      membershipId: 'membership-1',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      vehicleType: VehicleType.Car,
      brandId: null,
      brandName: null,
      modelId: null,
      modelName: null,
      customBrandName: 'Nissan',
      customModelName: 'Sentra',
      year: 2024,
      color: 'azul',
      plate: 'ABC123',
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UpToMedium,
      registrationDocumentFileKey: null,
      isActive: true,
      operationalTripCount: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    repository.findDefaultMembershipByUserId.mockResolvedValue(membership);
    repository.findVehicleByIdForMembership.mockResolvedValue(vehicle);

    const useCase = new GetVehicleRegistrationDocumentUseCase(repository, storageService);

    await expect(useCase.execute('user-1', 'vehicle-1')).rejects.toThrow(
      new NotFoundException('El vehiculo no tiene un documento de matricula registrado.'),
    );
  });

  it('successfully returns readRegistrationDocument result', async () => {
    const repository = createVehiclesRepositoryMock();
    const storageService = createVehicleDocumentStorageServiceMock();
    const membership: VehicleMembershipRecord = {
      id: 'membership-1',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    };
    const vehicle: VehicleRecord = {
      id: 'vehicle-1',
      membershipId: 'membership-1',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      vehicleType: VehicleType.Car,
      brandId: null,
      brandName: null,
      modelId: null,
      modelName: null,
      customBrandName: 'Nissan',
      customModelName: 'Sentra',
      year: 2024,
      color: 'azul',
      plate: 'ABC123',
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UpToMedium,
      registrationDocumentFileKey: 'doc-key',
      isActive: true,
      operationalTripCount: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const document: RetrievedVehicleDocument = {
      fileName: 'matricula.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('pdf-content'),
    };
    repository.findDefaultMembershipByUserId.mockResolvedValue(membership);
    repository.findVehicleByIdForMembership.mockResolvedValue(vehicle);
    storageService.readRegistrationDocument.mockResolvedValue(document);

    const useCase = new GetVehicleRegistrationDocumentUseCase(repository, storageService);
    const result = await useCase.execute('user-1', 'vehicle-1');

    expect(storageService.readRegistrationDocument).toHaveBeenCalledWith('doc-key');
    expect(result).toEqual(document);
  });
});
