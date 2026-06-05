import { BadRequestException } from '@nestjs/common';
import type {
  InstitutionSummary,
  InstitutionsRepository,
} from '../../../src/modules/institutions/application/ports/institutions.repository';
import { CreateInstitutionUseCase } from '../../../src/modules/institutions/application/use-cases/create-institution.use-case';

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

describe('CreateInstitutionUseCase', () => {
  it('throws BadRequestException if no valid domains are registered', async () => {
    const repository = createInstitutionsRepositoryMock();
    const useCase = new CreateInstitutionUseCase(repository);

    await expect(
      useCase.execute({
        name: 'Universidad',
        code: 'UD',
        domains: [' ', ''],
      }),
    ).rejects.toThrow(new BadRequestException('Debes registrar al menos un dominio institucional activo.'));
  });

  it('normalizes domains and creates institution successfully', async () => {
    const repository = createInstitutionsRepositoryMock();
    const createdInstitution: InstitutionSummary = {
      id: 'inst-1',
      name: 'Universidad Técnica de Ambato',
      code: 'UTA',
      domains: ['uta.edu.ec'],
      isActive: true,
    };
    repository.create.mockResolvedValue(createdInstitution);

    const useCase = new CreateInstitutionUseCase(repository);
    const result = await useCase.execute({
      name: ' Universidad Técnica de Ambato ',
      code: ' uta ',
      domains: ['UTA.EDU.EC', 'uta.edu.ec', '  '],
    });

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Universidad Técnica de Ambato',
      code: 'UTA',
      domains: ['uta.edu.ec'],
    });
    expect(result).toEqual(createdInstitution);
  });
});
