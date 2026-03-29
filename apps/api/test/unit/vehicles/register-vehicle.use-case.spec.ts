import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { RegisterVehicleUseCase } from '../../../src/modules/vehicles/application/use-cases/register-vehicle.use-case';
import type {
  CreateVehicleInput,
  VehicleRecord,
  VehiclesRepository,
} from '../../../src/modules/vehicles/application/ports/vehicles.repository';

function createVehiclesRepositoryMock(): jest.Mocked<VehiclesRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    listLicenseTypes: jest.fn(),
    listVehicleBrands: jest.fn(),
    listVehicleModels: jest.fn(),
    findVehicleBrandById: jest.fn(),
    findVehicleModelById: jest.fn(),
    findVehicleByPlate: jest.fn(),
    findVehiclesByMembershipId: jest.fn(),
    createVehicle: jest.fn(),
  };
}

function buildCreatedVehicle(input: CreateVehicleInput): VehicleRecord {
  return {
    id: 'vehicle-1',
    membershipId: input.membershipId,
    institutionId: 'institution-1',
    institutionName: 'UTA',
    vehicleType: input.vehicleType,
    brandId: input.brandId ?? null,
    brandName: 'Toyota',
    modelId: input.modelId ?? null,
    modelName: 'Yaris',
    customBrandName: input.customBrandName ?? null,
    customModelName: input.customModelName ?? null,
    year: input.year,
    color: input.color,
    plate: input.plate,
    seatCount: input.seatCount,
    luggagePolicy: input.luggagePolicy,
    registrationDocumentFileKey: input.registrationDocumentFileKey ?? null,
    isActive: true,
    createdAt: new Date('2030-01-01T10:00:00.000Z'),
  };
}

describe('RegisterVehicleUseCase', () => {
  it('rejects motorcycles with an invalid passenger capacity', async () => {
    const repository = createVehiclesRepositoryMock();
    const useCase = new RegisterVehicleUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });

    await expect(
      useCase.execute({
        userId: 'user-1',
        vehicleType: VehicleType.Motorcycle,
        customBrandName: 'Yamaha',
        customModelName: 'FZ',
        year: 2025,
        color: 'Azul',
        plate: 'ab-123',
        seatCount: 2,
        luggagePolicy: LuggagePolicy.NotAllowed,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'La capacidad permitida para este tipo de vehiculo es de 1 a 1 pasajeros.',
      ),
    );
  });

  it('validates the model brand relation and normalizes the plate on success', async () => {
    const repository = createVehiclesRepositoryMock();
    const useCase = new RegisterVehicleUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findVehicleBrandById.mockResolvedValue({
      id: 'brand-1',
      name: 'Toyota',
    });
    repository.findVehicleModelById.mockResolvedValue({
      id: 'model-1',
      brandId: 'brand-1',
      brandName: 'Toyota',
      name: 'Yaris',
      vehicleType: VehicleType.Car,
      isActive: true,
    });
    repository.findVehicleByPlate.mockResolvedValue(null);
    repository.createVehicle.mockImplementation(async (input) => buildCreatedVehicle(input));

    const response = await useCase.execute({
      userId: 'user-1',
      vehicleType: VehicleType.Car,
      brandId: 'brand-1',
      modelId: 'model-1',
      year: 2025,
      color: '  Gris  ',
      plate: '  abc-123  ',
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UpToMedium,
    });

    expect(response.message).toBe('Vehiculo registrado correctamente.');
    expect(repository.createVehicle).toHaveBeenCalledWith({
      membershipId: 'membership-1',
      vehicleType: VehicleType.Car,
      brandId: 'brand-1',
      modelId: 'model-1',
      customBrandName: undefined,
      customModelName: undefined,
      year: 2025,
      color: 'Gris',
      plate: 'ABC-123',
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UpToMedium,
      registrationDocumentFileKey: undefined,
    });
  });

  it('rejects a model that does not belong to the selected brand', async () => {
    const repository = createVehiclesRepositoryMock();
    const useCase = new RegisterVehicleUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findVehicleBrandById.mockResolvedValue({
      id: 'brand-1',
      name: 'Toyota',
    });
    repository.findVehicleModelById.mockResolvedValue({
      id: 'model-1',
      brandId: 'brand-2',
      brandName: 'Chevrolet',
      name: 'Spark',
      vehicleType: VehicleType.Car,
      isActive: true,
    });

    await expect(
      useCase.execute({
        userId: 'user-1',
        vehicleType: VehicleType.Car,
        brandId: 'brand-1',
        modelId: 'model-1',
        year: 2025,
        color: 'Rojo',
        plate: 'abc-123',
        seatCount: 4,
        luggagePolicy: LuggagePolicy.UpToMedium,
      }),
    ).rejects.toThrow(
      new BadRequestException('El modelo seleccionado no pertenece a la marca indicada.'),
    );
  });

  it('blocks approved drivers whose license is expired', async () => {
    const repository = createVehiclesRepositoryMock();
    const useCase = new RegisterVehicleUseCase(repository);

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
      useCase.execute({
        userId: 'user-1',
        vehicleType: VehicleType.Car,
        customBrandName: 'Marca',
        customModelName: 'Modelo',
        year: 2025,
        color: 'Azul',
        plate: 'ab-123',
        seatCount: 4,
        luggagePolicy: LuggagePolicy.UpToMedium,
      }),
    ).rejects.toThrow(
      new ForbiddenException(
        'Tu licencia vencio. Debes actualizarla antes de registrar vehiculos.',
      ),
    );
  });
});
