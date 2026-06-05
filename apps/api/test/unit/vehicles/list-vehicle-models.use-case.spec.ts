import { VehicleType } from '@saferidepro/shared-types';
import type {
  VehicleModelCatalogItem,
  VehiclesRepository,
} from '../../../src/modules/vehicles/application/ports/vehicles.repository';
import { ListVehicleModelsUseCase } from '../../../src/modules/vehicles/application/use-cases/list-vehicle-models.use-case';

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

describe('ListVehicleModelsUseCase', () => {
  it('calls listVehicleModels on repository and returns result', async () => {
    const repository = createVehiclesRepositoryMock();
    const mockModels: VehicleModelCatalogItem[] = [
      {
        id: 'model-1',
        brandId: 'brand-1',
        brandName: 'Toyota',
        name: 'Corolla',
        vehicleType: VehicleType.Car,
        isActive: true,
      },
    ];
    repository.listVehicleModels.mockResolvedValue(mockModels);

    const useCase = new ListVehicleModelsUseCase(repository);
    const result = await useCase.execute({ brandId: 'brand-1', vehicleType: VehicleType.Car });

    expect(repository.listVehicleModels).toHaveBeenCalledWith({ brandId: 'brand-1', vehicleType: VehicleType.Car });
    expect(result).toBe(mockModels);
  });
});
