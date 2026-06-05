import type {
  InstitutionSummary,
  InstitutionsRepository,
} from '../../../src/modules/institutions/application/ports/institutions.repository';
import { ListActiveInstitutionsUseCase } from '../../../src/modules/institutions/application/use-cases/list-active-institutions.use-case';

function createInstitutionsRepositoryMock(): jest.Mocked<InstitutionsRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    listActive: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    updateStatus: jest.fn(),
  };
}

describe('ListActiveInstitutionsUseCase', () => {
  it('should call listActive repository method and return active institutions', async () => {
    const repository = createInstitutionsRepositoryMock();
    const mockList: InstitutionSummary[] = [
      { id: 'inst-1', name: 'UTA', code: 'UTA', domains: ['uta.edu.ec'], isActive: true },
    ];
    repository.listActive.mockResolvedValue(mockList);

    const useCase = new ListActiveInstitutionsUseCase(repository);
    const result = await useCase.execute();

    expect(repository.listActive).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockList);
  });
});
