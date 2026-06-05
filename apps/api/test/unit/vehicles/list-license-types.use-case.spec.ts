import type {
  LicenseTypeCatalogItem,
  VehiclesRepository,
} from '../../../src/modules/vehicles/application/ports/vehicles.repository';
import { ListLicenseTypesUseCase } from '../../../src/modules/vehicles/application/use-cases/list-license-types.use-case';

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

describe('ListLicenseTypesUseCase', () => {
  it('calls listLicenseTypes on repository and returns result', async () => {
    const repository = createVehiclesRepositoryMock();
    const mockLicenses: LicenseTypeCatalogItem[] = [{ id: 'lic-1', code: 'B', name: 'Type B' }];
    repository.listLicenseTypes.mockResolvedValue(mockLicenses);

    const useCase = new ListLicenseTypesUseCase(repository);
    const result = await useCase.execute();

    expect(repository.listLicenseTypes).toHaveBeenCalledTimes(1);
    expect(result).toBe(mockLicenses);
  });
});
