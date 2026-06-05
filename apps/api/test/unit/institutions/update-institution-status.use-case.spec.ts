import { NotFoundException } from '@nestjs/common';
import type {
  InstitutionSummary,
  InstitutionsRepository,
} from '../../../src/modules/institutions/application/ports/institutions.repository';
import { UpdateInstitutionStatusUseCase } from '../../../src/modules/institutions/application/use-cases/update-institution-status.use-case';

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

describe('UpdateInstitutionStatusUseCase', () => {
  it('throws NotFoundException if the institution does not exist', async () => {
    const repository = createInstitutionsRepositoryMock();
    repository.findById.mockResolvedValue(null);

    const useCase = new UpdateInstitutionStatusUseCase(repository);

    await expect(
      useCase.execute({
        institutionId: 'non-existent',
        isActive: false,
      }),
    ).rejects.toThrow(new NotFoundException('La institucion indicada no existe.'));
  });

  it('returns unchanged message if target status matches current status', async () => {
    const repository = createInstitutionsRepositoryMock();
    const mockInstitution: InstitutionSummary = {
      id: 'inst-1',
      name: 'UTA',
      code: 'UTA',
      domains: ['uta.edu.ec'],
      isActive: true,
    };
    repository.findById.mockResolvedValue(mockInstitution);

    const useCase = new UpdateInstitutionStatusUseCase(repository);

    const result = await useCase.execute({
      institutionId: 'inst-1',
      isActive: true,
    });

    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(result.message).toBe('La institucion ya se encuentra activa.');
    expect(result.institution).toBe(mockInstitution);
  });

  it('updates status and returns message if status is changing', async () => {
    const repository = createInstitutionsRepositoryMock();
    const mockInstitution: InstitutionSummary = {
      id: 'inst-1',
      name: 'UTA',
      code: 'UTA',
      domains: ['uta.edu.ec'],
      isActive: true,
    };
    const updatedInstitution: InstitutionSummary = {
      ...mockInstitution,
      isActive: false,
    };
    repository.findById.mockResolvedValue(mockInstitution);
    repository.updateStatus.mockResolvedValue(updatedInstitution);

    const useCase = new UpdateInstitutionStatusUseCase(repository);

    const result = await useCase.execute({
      institutionId: 'inst-1',
      isActive: false,
    });

    expect(repository.updateStatus).toHaveBeenCalledWith('inst-1', false);
    expect(result.message).toBe('La institucion fue suspendida correctamente.');
    expect(result.institution.isActive).toBe(false);
  });
});
