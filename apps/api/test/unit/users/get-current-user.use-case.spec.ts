import { NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  GlobalUserRole,
  UserOnboardingStatus,
} from '@saferidepro/shared-types';

import type {
  UserProfile,
  UsersRepository,
} from '../../../src/modules/users/application/ports/users.repository';
import { GetCurrentUserUseCase } from '../../../src/modules/users/application/use-cases/get-current-user.use-case';

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

describe('GetCurrentUserUseCase', () => {
  it('returns the user if found', async () => {
    const usersRepository = createUsersRepositoryMock();
    const mockUser: UserProfile = {
      id: 'user-1',
      email: 'user1@uta.edu.ec',
      fullName: 'User One',
      career: null,
      phone: null,
      referenceNeighborhood: null,
      documentType: 'NATIONAL_ID',
      documentNumber: '1710034065',
      globalRole: GlobalUserRole.User,
      accountStatus: AccountStatus.Active,
      profilePhotoUrl: null,
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      termsAcceptedAt: null,
      privacyAcceptedAt: null,
      safetyRulesAcceptedAt: null,
      onboardingCompletedAt: null,
      onboardingStatus: UserOnboardingStatus.Incomplete,
      missingOnboardingRequirements: [],
      requiresOnboarding: true,
      memberships: [],
    };
    usersRepository.findById.mockResolvedValue(mockUser);

    const useCase = new GetCurrentUserUseCase(usersRepository);
    const result = await useCase.execute('user-1');

    expect(usersRepository.findById).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(mockUser);
  });

  it('throws NotFoundException if user is not found', async () => {
    const usersRepository = createUsersRepositoryMock();
    usersRepository.findById.mockResolvedValue(null);

    const useCase = new GetCurrentUserUseCase(usersRepository);

    await expect(useCase.execute('non-existent')).rejects.toThrow(
      new NotFoundException('El usuario solicitado no existe.'),
    );
    expect(usersRepository.findById).toHaveBeenCalledWith('non-existent');
  });
});
