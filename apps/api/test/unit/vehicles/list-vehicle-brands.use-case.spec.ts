import { VehicleType } from '@saferidepro/shared-types';
import type {
  VehicleBrandCatalogItem,
  VehiclesRepository,
} from '../../../src/modules/vehicles/application/ports/vehicles.repository';
import { ListVehicleBrandsUseCase } from '../../../src/modules/vehicles/application/use-cases/list-vehicle-brands.use-case';

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

describe('ListVehicleBrandsUseCase', () => {
  it('calls listVehicleBrands on repository and returns result', async () => {
    const repository = createVehiclesRepositoryMock();
    const mockBrands: VehicleBrandCatalogItem[] = [{ id: 'brand-1', name: 'Toyota' }];
    repository.listVehicleBrands.mockResolvedValue(mockBrands);

    const useCase = new ListVehicleBrandsUseCase(repository);
    const result = await useCase.execute({ vehicleType: VehicleType.Car });

    expect(repository.listVehicleBrands).toHaveBeenCalledWith({ vehicleType: VehicleType.Car });
    expect(result).toBe(mockBrands);
  });
});
