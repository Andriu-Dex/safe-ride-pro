import { ListMySanctionAppealsUseCase } from '../../../src/modules/sanctions/application/use-cases/list-my-sanction-appeals.use-case';
import type { SanctionsRepository } from '../../../src/modules/sanctions/application/ports/sanctions.repository';
import { GlobalUserRole } from '@saferidepro/shared-types';

describe('ListMySanctionAppealsUseCase', () => {
  it('returns items from repository based on user id', async () => {
    const repository: jest.Mocked<SanctionsRepository> = {
      listAppealsByRequestedByUserId: jest.fn().mockResolvedValue([{ id: 'appeal-1' }]),
    } as any;

    const useCase = new ListMySanctionAppealsUseCase(repository);
    const result = await useCase.execute({
      id: 'user-1',
      globalRole: GlobalUserRole.User,
      memberships: [],
    } as any);

    expect(result).toEqual({ items: [{ id: 'appeal-1' }] });
    expect(repository.listAppealsByRequestedByUserId).toHaveBeenCalledWith('user-1');
  });
});
