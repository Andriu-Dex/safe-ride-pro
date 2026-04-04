import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import type {
  UpdateVehicleInput,
  VehicleRecord,
  VehiclesRepository,
} from '../../../src/modules/vehicles/application/ports/vehicles.repository';
import { UpdateVehicleUseCase } from '../../../src/modules/vehicles/application/use-cases/update-vehicle.use-case';

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

function buildVehicle(overrides: Partial<VehicleRecord> = {}): VehicleRecord {
  return {
    id: 'vehicle-1',
    membershipId: 'membership-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    vehicleType: VehicleType.Car,
    brandId: 'brand-1',
    brandName: 'Toyota',
    modelId: 'model-1',
    modelName: 'Yaris',
    customBrandName: null,
    customModelName: null,
    year: 2024,
    color: 'Gris',
    plate: 'ABC-123',
    seatCount: 4,
    luggagePolicy: LuggagePolicy.UpToMedium,
    registrationDocumentFileKey: null,
    isActive: true,
    operationalTripCount: 0,
    createdAt: new Date('2030-01-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('UpdateVehicleUseCase', () => {
  it('rejects updates for vehicles with operational trips', async () => {
    const repository = createVehiclesRepositoryMock();
    const useCase = new UpdateVehicleUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findVehicleByIdForMembership.mockResolvedValue(
      buildVehicle({ operationalTripCount: 1 }),
    );

    await expect(
      useCase.execute({
        userId: 'user-1',
        vehicleId: 'vehicle-1',
        vehicleType: VehicleType.Car,
        brandId: 'brand-1',
        modelId: 'model-1',
        year: 2025,
        color: 'Azul',
        plate: 'ABC-123',
        seatCount: 4,
        luggagePolicy: LuggagePolicy.UpToMedium,
        registrationDocumentFileKey: 'membership-1/registration/file-1.pdf',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'No puedes editar un vehiculo con viajes publicados, llenos o en curso.',
      ),
    );
  });

  it('rejects missing vehicles for the active membership', async () => {
    const repository = createVehiclesRepositoryMock();
    const useCase = new UpdateVehicleUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findVehicleByIdForMembership.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: 'user-1',
        vehicleId: 'vehicle-404',
        vehicleType: VehicleType.Car,
        brandId: 'brand-1',
        modelId: 'model-1',
        year: 2025,
        color: 'Azul',
        plate: 'ABC-123',
        seatCount: 4,
        luggagePolicy: LuggagePolicy.UpToMedium,
        registrationDocumentFileKey: 'membership-1/registration/file-1.pdf',
      }),
    ).rejects.toThrow(new NotFoundException('El vehiculo solicitado no existe.'));
  });

  it('updates the vehicle and preserves ownership validation', async () => {
    const repository = createVehiclesRepositoryMock();
    const useCase = new UpdateVehicleUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findVehicleByIdForMembership.mockResolvedValue(buildVehicle());
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
    repository.findVehicleByPlate.mockResolvedValue(buildVehicle());
    repository.updateVehicle.mockImplementation(async (input: UpdateVehicleInput) =>
      buildVehicle({
        vehicleType: input.vehicleType,
        year: input.year,
        color: input.color,
        plate: input.plate,
        seatCount: input.seatCount,
        luggagePolicy: input.luggagePolicy,
      }),
    );

    const response = await useCase.execute({
      userId: 'user-1',
      vehicleId: 'vehicle-1',
      vehicleType: VehicleType.Car,
      brandId: 'brand-1',
      modelId: 'model-1',
      year: 2025,
      color: '  Azul oscuro ',
      plate: ' abc-123 ',
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UpToMedium,
      registrationDocumentFileKey: 'membership-1/registration/file-2.pdf',
    });

    expect(response.message).toBe('Vehiculo actualizado correctamente.');
    expect(repository.updateVehicle).toHaveBeenCalledWith({
      vehicleId: 'vehicle-1',
      membershipId: 'membership-1',
      vehicleType: VehicleType.Car,
      brandId: 'brand-1',
      modelId: 'model-1',
      customBrandName: undefined,
      customModelName: undefined,
      year: 2025,
      color: 'Azul oscuro',
      plate: 'ABC-123',
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UpToMedium,
      registrationDocumentFileKey: 'membership-1/registration/file-2.pdf',
    });
  });
});
