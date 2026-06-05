import { ForbiddenException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import type { UsersRepository } from '../../../src/modules/users/application/ports/users.repository';
import { ListAdminUserDirectoryUseCase } from '../../../src/modules/users/application/use-cases/list-admin-user-directory.use-case';

function createUsersRepositoryMock(): jest.Mocked<UsersRepository> {
  return {
    findById: jest.fn(),
    findProfilePhotoRecordById: jest.fn(),
    updateProfile: jest.fn(),
    updateAccountStatus: jest.fn(),
    updateProfilePhoto: jest.fn(),
    getTrustSummary: jest.fn(),
    listAdminUserDirectory: jest.fn(),
  };
}

function buildCurrentUser(overrides: Partial<CurrentUserContext> = {}): CurrentUserContext {
  return {
    id: 'admin-user-1',
    email: 'admin@uta.edu.ec',
    fullName: 'Admin Uno',
    globalRole: GlobalUserRole.SuperAdmin,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-admin-1',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        institutionIsActive: true,
        role: InstitutionMembershipRole.InstitutionAdmin,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'ADMIN-001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
    ...overrides,
  };
}

describe('ListAdminUserDirectoryUseCase', () => {
  it('excludes the current user from the administrative directory query', async () => {
    const usersRepository = createUsersRepositoryMock();
    usersRepository.listAdminUserDirectory.mockResolvedValue([]);

    const useCase = new ListAdminUserDirectoryUseCase(usersRepository);

    await useCase.execute({
      currentUser: buildCurrentUser(),
    });

    expect(usersRepository.listAdminUserDirectory).toHaveBeenCalledWith({
      institutionIds: undefined,
      excludeUserIds: ['admin-user-1'],
      query: undefined,
      accountStatus: undefined,
      driverVerificationStatus: undefined,
      limit: undefined,
    });
  });

  it('rejects users without administrative scope', async () => {
    const usersRepository = createUsersRepositoryMock();
    const useCase = new ListAdminUserDirectoryUseCase(usersRepository);

    await expect(
      useCase.execute({
        currentUser: buildCurrentUser({
          globalRole: GlobalUserRole.User,
          memberships: [
            {
              id: 'membership-student-1',
              institutionId: 'institution-1',
              institutionName: 'UTA',
              institutionIsActive: true,
              role: InstitutionMembershipRole.Student,
              membershipStatus: MembershipStatus.Active,
              studentCode: 'STU-001',
              isDefault: true,
              driverVerificationStatus: DriverVerificationStatus.NotRequested,
            },
          ],
        }),
      }),
    ).rejects.toThrow(new ForbiddenException('No tienes permisos para gestionar usuarios.'));
  });

  it('rejects if non-superadmin tries to access an institution they do not administer', async () => {
    const usersRepository = createUsersRepositoryMock();
    const useCase = new ListAdminUserDirectoryUseCase(usersRepository);

    await expect(
      useCase.execute({
        currentUser: buildCurrentUser({
          globalRole: GlobalUserRole.User,
          memberships: [
            {
              id: 'membership-admin-1',
              institutionId: 'institution-1',
              institutionName: 'UTA',
              institutionIsActive: true,
              role: InstitutionMembershipRole.InstitutionAdmin,
              membershipStatus: MembershipStatus.Active,
              studentCode: 'ADMIN-001',
              isDefault: true,
              driverVerificationStatus: DriverVerificationStatus.NotRequested,
            },
          ],
        }),
        institutionId: 'institution-2',
      }),
    ).rejects.toThrow(new ForbiddenException('No tienes permisos para gestionar usuarios de esa institucion.'));
  });

  it('allows non-superadmin to query their own institution', async () => {
    const usersRepository = createUsersRepositoryMock();
    usersRepository.listAdminUserDirectory.mockResolvedValue([]);
    const useCase = new ListAdminUserDirectoryUseCase(usersRepository);

    const currentUser = buildCurrentUser({
      globalRole: GlobalUserRole.User,
      memberships: [
        {
          id: 'membership-admin-1',
          institutionId: 'institution-1',
          institutionName: 'UTA',
          institutionIsActive: true,
          role: InstitutionMembershipRole.InstitutionAdmin,
          membershipStatus: MembershipStatus.Active,
          studentCode: 'ADMIN-001',
          isDefault: true,
          driverVerificationStatus: DriverVerificationStatus.NotRequested,
        },
      ],
    });

    await useCase.execute({
      currentUser,
      institutionId: 'institution-1',
    });

    expect(usersRepository.listAdminUserDirectory).toHaveBeenCalledWith(
      expect.objectContaining({
        institutionIds: ['institution-1'],
      }),
    );
  });
});
