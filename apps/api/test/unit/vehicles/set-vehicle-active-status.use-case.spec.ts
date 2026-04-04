import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import type {
  VehicleRecord,
  VehiclesRepository,
} from '../../../src/modules/vehicles/application/ports/vehicles.repository';
import { SetVehicleActiveStatusUseCase } from '../../../src/modules/vehicles/application/use-cases/set-vehicle-active-status.use-case';

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

describe('SetVehicleActiveStatusUseCase', () => {
  it('rejects missing vehicles for the active membership', async () => {
    const repository = createVehiclesRepositoryMock();
    const useCase = new SetVehicleActiveStatusUseCase(repository);

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
        isActive: false,
      }),
    ).rejects.toThrow(new NotFoundException('El vehiculo solicitado no existe.'));
  });

  it('blocks deactivation when there are operational trips', async () => {
    const repository = createVehiclesRepositoryMock();
    const useCase = new SetVehicleActiveStatusUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findVehicleByIdForMembership.mockResolvedValue(
      buildVehicle({ operationalTripCount: 2 }),
    );

    await expect(
      useCase.execute({
        userId: 'user-1',
        vehicleId: 'vehicle-1',
        isActive: false,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'No puedes desactivar un vehiculo con viajes publicados, llenos o en curso.',
      ),
    );
  });

  it('updates the active status when the vehicle is available', async () => {
    const repository = createVehiclesRepositoryMock();
    const useCase = new SetVehicleActiveStatusUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findVehicleByIdForMembership.mockResolvedValue(buildVehicle());
    repository.updateVehicleStatus.mockImplementation(async (_vehicleId, isActive) =>
      buildVehicle({ isActive }),
    );

    const response = await useCase.execute({
      userId: 'user-1',
      vehicleId: 'vehicle-1',
      isActive: false,
    });

    expect(response.message).toBe('Vehiculo desactivado correctamente.');
    expect(repository.updateVehicleStatus).toHaveBeenCalledWith('vehicle-1', false);
  });
});
