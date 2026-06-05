import {
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  VehicleType,
} from '@saferidepro/shared-types';
import type {
  VehicleMembershipRecord,
  VehicleRecord,
  VehiclesRepository,
} from '../../../src/modules/vehicles/application/ports/vehicles.repository';
import { GetCurrentUserVehiclesUseCase } from '../../../src/modules/vehicles/application/use-cases/get-current-user-vehicles.use-case';

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

describe('GetCurrentUserVehiclesUseCase', () => {
  it('returns null membership and empty vehicles if membership is not found', async () => {
    const repository = createVehiclesRepositoryMock();
    repository.findDefaultMembershipByUserId.mockResolvedValue(null);

    const useCase = new GetCurrentUserVehiclesUseCase(repository);
    const result = await useCase.execute('user-1');

    expect(repository.findDefaultMembershipByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      membership: null,
      vehicles: [],
    });
  });

  it('returns membership and list of vehicles if membership exists', async () => {
    const repository = createVehiclesRepositoryMock();
    const mockMembership: VehicleMembershipRecord = {
      id: 'membership-1',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    };
    const mockVehicles: VehicleRecord[] = [
      {
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
        plate: 'ABC-123',
        seatCount: 4,
        luggagePolicy: LuggagePolicy.UpToMedium,
        registrationDocumentFileKey: null,
        isActive: true,
        operationalTripCount: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];

    repository.findDefaultMembershipByUserId.mockResolvedValue(mockMembership);
    repository.findVehiclesByMembershipId.mockResolvedValue(mockVehicles);

    const useCase = new GetCurrentUserVehiclesUseCase(repository);
    const result = await useCase.execute('user-1');

    expect(repository.findDefaultMembershipByUserId).toHaveBeenCalledWith('user-1');
    expect(repository.findVehiclesByMembershipId).toHaveBeenCalledWith('membership-1');
    expect(result).toEqual({
      membership: mockMembership,
      vehicles: mockVehicles,
    });
  });
});
