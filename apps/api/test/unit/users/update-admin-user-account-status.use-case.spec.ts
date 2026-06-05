import { ForbiddenException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  UserOnboardingStatus,
} from '@saferidepro/shared-types';

import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import type {
  UserProfile,
  UsersRepository,
} from '../../../src/modules/users/application/ports/users.repository';
import { UpdateAdminUserAccountStatusUseCase } from '../../../src/modules/users/application/use-cases/update-admin-user-account-status.use-case';

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
    id: 'admin-1',
    email: 'admin@uta.edu.ec',
    fullName: 'Admin User',
    globalRole: GlobalUserRole.SuperAdmin,
    accountStatus: AccountStatus.Active,
    memberships: [],
    ...overrides,
  };
}

function buildTargetUser(
  overrides: Partial<UserProfile> = {},
  membershipOverrides: Partial<UserProfile['memberships'][number]>[] = [],
): UserProfile {
  return {
    id: 'target-1',
    email: 'target@uta.edu.ec',
    fullName: 'Target User',
    career: null,
    phone: null,
    referenceNeighborhood: null,
    documentType: 'NATIONAL_ID',
    documentNumber: '1710034065',
    profilePhotoUrl: null,
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    emailVerifiedAt: null,
    termsAcceptedAt: null,
    privacyAcceptedAt: null,
    safetyRulesAcceptedAt: null,
    onboardingCompletedAt: null,
    onboardingStatus: UserOnboardingStatus.Incomplete,
    missingOnboardingRequirements: [],
    requiresOnboarding: true,
    memberships: membershipOverrides.map((membership, index) => ({
      id: `target-membership-${index + 1}`,
      institutionId: `inst-${index + 1}`,
      institutionName: 'UTA',
      role: InstitutionMembershipRole.Student,
      membershipStatus: MembershipStatus.Active,
      studentCode: `T00${index + 1}`,
      isDefault: index === 0,
      driverVerificationStatus: DriverVerificationStatus.NotRequested,
      ...membership,
    })),
    ...overrides,
  };
}

describe('UpdateAdminUserAccountStatusUseCase', () => {
  it('throws ForbiddenException when updating own account status', async () => {
    const usersRepository = createUsersRepositoryMock();
    const useCase = new UpdateAdminUserAccountStatusUseCase(usersRepository);

    await expect(
      useCase.execute({
        currentUser: buildCurrentUser({ id: 'admin-1' }),
        userId: 'admin-1',
        accountStatus: AccountStatus.Suspended,
      }),
    ).rejects.toThrow(new ForbiddenException('No puedes modificar el estado de tu propia cuenta.'));
  });

  it('throws ForbiddenException when target user is not found', async () => {
    const usersRepository = createUsersRepositoryMock();
    usersRepository.findById.mockResolvedValue(null);
    const useCase = new UpdateAdminUserAccountStatusUseCase(usersRepository);

    await expect(
      useCase.execute({
        currentUser: buildCurrentUser({ id: 'admin-1' }),
        userId: 'target-1',
        accountStatus: AccountStatus.Suspended,
      }),
    ).rejects.toThrow(new ForbiddenException('El usuario solicitado no existe o no es accesible.'));
  });

  it('throws ForbiddenException if current user is not SuperAdmin and has no accessible institutions', async () => {
    const usersRepository = createUsersRepositoryMock();
    usersRepository.findById.mockResolvedValue(buildTargetUser({}, []));
    const useCase = new UpdateAdminUserAccountStatusUseCase(usersRepository);

    await expect(
      useCase.execute({
        currentUser: buildCurrentUser({
          id: 'admin-1',
          globalRole: GlobalUserRole.User,
          memberships: [
            {
              id: 'm1',
              institutionId: 'inst-1',
              institutionName: 'UTA',
              institutionIsActive: true,
              role: InstitutionMembershipRole.Student,
              membershipStatus: MembershipStatus.Active,
              studentCode: '123',
              isDefault: true,
              driverVerificationStatus: DriverVerificationStatus.NotRequested,
            },
          ],
        }),
        userId: 'target-1',
        accountStatus: AccountStatus.Suspended,
      }),
    ).rejects.toThrow(new ForbiddenException('No tienes permisos para gestionar usuarios.'));
  });

  it('throws ForbiddenException if target user is not in accessible institutions', async () => {
    const usersRepository = createUsersRepositoryMock();
    usersRepository.findById.mockResolvedValue(
      buildTargetUser({}, [{ institutionId: 'inst-2', institutionName: 'Otra' }]),
    );
    const useCase = new UpdateAdminUserAccountStatusUseCase(usersRepository);

    await expect(
      useCase.execute({
        currentUser: buildCurrentUser({
          id: 'admin-1',
          globalRole: GlobalUserRole.User,
          memberships: [
            {
              id: 'm1',
              institutionId: 'inst-1',
              institutionName: 'UTA',
              institutionIsActive: true,
              role: InstitutionMembershipRole.InstitutionAdmin,
              membershipStatus: MembershipStatus.Active,
              studentCode: '123',
              isDefault: true,
              driverVerificationStatus: DriverVerificationStatus.NotRequested,
            },
          ],
        }),
        userId: 'target-1',
        accountStatus: AccountStatus.Suspended,
      }),
    ).rejects.toThrow(new ForbiddenException('No tienes permisos para modificar este usuario.'));
  });

  it('throws ForbiddenException if target user is InstitutionAdmin but current user is not SuperAdmin', async () => {
    const usersRepository = createUsersRepositoryMock();
    usersRepository.findById.mockResolvedValue(
      buildTargetUser({}, [{ institutionId: 'inst-1', role: InstitutionMembershipRole.InstitutionAdmin }]),
    );
    const useCase = new UpdateAdminUserAccountStatusUseCase(usersRepository);

    await expect(
      useCase.execute({
        currentUser: buildCurrentUser({
          id: 'admin-1',
          globalRole: GlobalUserRole.User,
          memberships: [
            {
              id: 'm1',
              institutionId: 'inst-1',
              institutionName: 'UTA',
              institutionIsActive: true,
              role: InstitutionMembershipRole.InstitutionAdmin,
              membershipStatus: MembershipStatus.Active,
              studentCode: '123',
              isDefault: true,
              driverVerificationStatus: DriverVerificationStatus.NotRequested,
            },
          ],
        }),
        userId: 'target-1',
        accountStatus: AccountStatus.Suspended,
      }),
    ).rejects.toThrow(
      new ForbiddenException('Solo superadministracion puede modificar cuentas administrativas.'),
    );
  });

  it('successfully suspends a target user as SuperAdmin', async () => {
    const usersRepository = createUsersRepositoryMock();
    const mockTargetUser = buildTargetUser({}, [{ institutionId: 'inst-1' }]);
    usersRepository.findById.mockResolvedValue(mockTargetUser);
    usersRepository.updateAccountStatus.mockResolvedValue({
      ...mockTargetUser,
      accountStatus: AccountStatus.Suspended,
    });

    const useCase = new UpdateAdminUserAccountStatusUseCase(usersRepository);
    const result = await useCase.execute({
      currentUser: buildCurrentUser({ globalRole: GlobalUserRole.SuperAdmin }),
      userId: 'target-1',
      accountStatus: AccountStatus.Suspended,
    });

    expect(usersRepository.updateAccountStatus).toHaveBeenCalledWith('target-1', AccountStatus.Suspended);
    expect(result.message).toBe('La cuenta fue bloqueada correctamente.');
  });

  it('successfully reactivates a target user as InstitutionAdmin of same institution', async () => {
    const usersRepository = createUsersRepositoryMock();
    const mockTargetUser = buildTargetUser(
      { accountStatus: AccountStatus.Suspended },
      [{ institutionId: 'inst-1', role: InstitutionMembershipRole.Student }],
    );
    usersRepository.findById.mockResolvedValue(mockTargetUser);
    usersRepository.updateAccountStatus.mockResolvedValue({
      ...mockTargetUser,
      accountStatus: AccountStatus.Active,
    });

    const useCase = new UpdateAdminUserAccountStatusUseCase(usersRepository);
    const result = await useCase.execute({
      currentUser: buildCurrentUser({
        globalRole: GlobalUserRole.User,
        memberships: [
          {
            id: 'm1',
            institutionId: 'inst-1',
            institutionName: 'UTA',
            institutionIsActive: true,
            role: InstitutionMembershipRole.InstitutionAdmin,
            membershipStatus: MembershipStatus.Active,
            studentCode: '123',
            isDefault: true,
            driverVerificationStatus: DriverVerificationStatus.NotRequested,
          },
        ],
      }),
      userId: 'target-1',
      accountStatus: AccountStatus.Active,
    });

    expect(usersRepository.updateAccountStatus).toHaveBeenCalledWith('target-1', AccountStatus.Active);
    expect(result.message).toBe('La cuenta fue reactivada correctamente.');
  });
});
