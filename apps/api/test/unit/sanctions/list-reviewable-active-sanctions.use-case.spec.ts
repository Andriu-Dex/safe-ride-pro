import { ListReviewableActiveSanctionsUseCase } from '../../../src/modules/sanctions/application/use-cases/list-reviewable-active-sanctions.use-case';
import type { SanctionsRepository } from '../../../src/modules/sanctions/application/ports/sanctions.repository';
import { GlobalUserRole, InstitutionMembershipRole, MembershipStatus } from '@saferidepro/shared-types';
import { ForbiddenException } from '@nestjs/common';

describe('ListReviewableActiveSanctionsUseCase', () => {
  let repository: jest.Mocked<SanctionsRepository>;
  let useCase: ListReviewableActiveSanctionsUseCase;

  beforeEach(() => {
    repository = {
      listReviewableActiveSanctions: jest.fn().mockResolvedValue([{ id: 'sanction-1' }]),
    } as any;
    useCase = new ListReviewableActiveSanctionsUseCase(repository);
  });

  it('allows SuperAdmin to view all active sanctions', async () => {
    const result = await useCase.execute({
      currentUser: {
        id: 'superadmin',
        globalRole: GlobalUserRole.SuperAdmin,
        memberships: [],
      } as any,
    });

    expect(result).toEqual({ items: [{ id: 'sanction-1' }] });
    expect(repository.listReviewableActiveSanctions).toHaveBeenCalledWith(
      expect.objectContaining({
        institutionIds: undefined,
      }),
    );
  });

  it('allows SuperAdmin to view active sanctions filtered by institution', async () => {
    const result = await useCase.execute({
      currentUser: {
        id: 'superadmin',
        globalRole: GlobalUserRole.SuperAdmin,
        memberships: [],
      } as any,
      institutionId: 'inst-1',
    });

    expect(result).toEqual({ items: [{ id: 'sanction-1' }] });
    expect(repository.listReviewableActiveSanctions).toHaveBeenCalledWith(
      expect.objectContaining({
        institutionIds: ['inst-1'],
      }),
    );
  });

  it('allows InstitutionAdmin to view active sanctions for their institution', async () => {
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
    });

    expect(result).toEqual({ items: [{ id: 'sanction-1' }] });
    expect(repository.listReviewableActiveSanctions).toHaveBeenCalledWith(
      expect.objectContaining({
        institutionIds: ['inst-1'],
      }),
    );
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

  it('throws ForbiddenException if InstitutionAdmin queries another institution', async () => {
    await expect(
      useCase.execute({
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
        institutionId: 'inst-2',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
