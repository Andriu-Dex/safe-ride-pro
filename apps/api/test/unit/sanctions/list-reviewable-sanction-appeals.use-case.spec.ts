import { ListReviewableSanctionAppealsUseCase } from '../../../src/modules/sanctions/application/use-cases/list-reviewable-sanction-appeals.use-case';
import type { SanctionsRepository } from '../../../src/modules/sanctions/application/ports/sanctions.repository';
import { GlobalUserRole, InstitutionMembershipRole, MembershipStatus, OperationalSanctionAppealStatus } from '@saferidepro/shared-types';
import { ForbiddenException } from '@nestjs/common';

describe('ListReviewableSanctionAppealsUseCase', () => {
  let repository: jest.Mocked<SanctionsRepository>;
  let useCase: ListReviewableSanctionAppealsUseCase;

  beforeEach(() => {
    repository = {
      listReviewableOperationalSanctionAppeals: jest.fn().mockResolvedValue([{ id: 'appeal-1' }]),
    } as any;
    useCase = new ListReviewableSanctionAppealsUseCase(repository);
  });

  it('allows SuperAdmin to view all sanction appeals', async () => {
    const result = await useCase.execute({
      currentUser: {
        id: 'superadmin',
        globalRole: GlobalUserRole.SuperAdmin,
        memberships: [],
      } as any,
      status: OperationalSanctionAppealStatus.Pending,
    });

    expect(result).toEqual({ items: [{ id: 'appeal-1' }] });
    expect(repository.listReviewableOperationalSanctionAppeals).toHaveBeenCalledWith({
      institutionIds: undefined,
      status: OperationalSanctionAppealStatus.Pending,
      limit: undefined,
    });
  });

  it('allows InstitutionAdmin to view appeals from their institution', async () => {
    const result = await useCase.execute({
      currentUser: {
        id: 'admin-1',
        globalRole: GlobalUserRole.User,
        memberships: [
          {
            institutionId: 'inst-1',
            role: InstitutionMembershipRole.InstitutionAdmin,
            membershipStatus: MembershipStatus.Active,
          },
        ],
      } as any,
      institutionId: 'inst-1',
      limit: 10,
    });

    expect(result).toEqual({ items: [{ id: 'appeal-1' }] });
    expect(repository.listReviewableOperationalSanctionAppeals).toHaveBeenCalledWith({
      institutionIds: ['inst-1'],
      status: undefined,
      limit: 10,
    });
  });

  it('throws ForbiddenException if user has no administrative roles', async () => {
    await expect(
      useCase.execute({
        currentUser: {
          id: 'user-1',
          globalRole: GlobalUserRole.User,
          memberships: [],
        } as any,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
