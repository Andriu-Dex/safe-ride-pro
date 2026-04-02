import { BadRequestException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  UserOnboardingStatus,
} from '@saferidepro/shared-types';

import type { UsersRepository } from '../../../src/modules/users/application/ports/users.repository';
import { UpdateCurrentUserUseCase } from '../../../src/modules/users/application/use-cases/update-current-user.use-case';

function createUsersRepositoryMock(): jest.Mocked<UsersRepository> {
  return {
    findById: jest.fn(),
    updateProfile: jest.fn(),
    getTrustSummary: jest.fn(),
  };
}

function buildUserProfile() {
  return {
    id: 'user-1',
    email: 'user@uta.edu.ec',
    fullName: 'Usuario Uno',
    career: null,
    phone: null,
    referenceNeighborhood: null,
    documentType: 'NATIONAL_ID',
    documentNumber: '1710034065',
    profilePhotoUrl: null,
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    emailVerifiedAt: new Date('2030-01-01T08:00:00.000Z'),
    termsAcceptedAt: null,
    privacyAcceptedAt: null,
    safetyRulesAcceptedAt: null,
    onboardingCompletedAt: null,
    onboardingStatus: UserOnboardingStatus.Incomplete,
    missingOnboardingRequirements: [],
    requiresOnboarding: true,
    memberships: [
      {
        id: 'membership-1',
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
  };
}

describe('UpdateCurrentUserUseCase', () => {
  it('rejects invalid Ecuadorian mobile phones', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new UpdateCurrentUserUseCase(repository);
    repository.findById.mockResolvedValue(buildUserProfile() as never);

    await expect(
      useCase.execute('user-1', {
        phone: '0812345678',
      }),
    ).rejects.toThrow(
      new BadRequestException('El celular debe tener 10 digitos y empezar con 09.'),
    );

    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('normalizes optional profile fields before persisting them', async () => {
    const repository = createUsersRepositoryMock();
    repository.updateProfile.mockResolvedValue({
      ...buildUserProfile(),
      fullName: 'Usuario Actualizado',
      career: 'Software',
      phone: '0999999999',
      referenceNeighborhood: 'Ficoa',
      profilePhotoUrl: 'https://example.com/profile.jpg',
    } as never);
    const useCase = new UpdateCurrentUserUseCase(repository);
    repository.findById.mockResolvedValue(buildUserProfile() as never);

    await useCase.execute('user-1', {
      fullName: '  Usuario Actualizado  ',
      career: '  Software  ',
      phone: ' 0999999999 ',
      referenceNeighborhood: '  Ficoa  ',
      profilePhotoUrl: ' https://example.com/profile.jpg ',
    });

    expect(repository.updateProfile).toHaveBeenCalledWith('user-1', {
      fullName: 'Usuario Actualizado',
      career: 'Software',
      phone: '0999999999',
      referenceNeighborhood: 'Ficoa',
      profilePhotoUrl: 'https://example.com/profile.jpg',
      termsAcceptedAt: undefined,
      privacyAcceptedAt: undefined,
      safetyRulesAcceptedAt: undefined,
      onboardingCompletedAt: undefined,
    });
  });

  it('marks onboarding as completed when all required fields are satisfied', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new UpdateCurrentUserUseCase(repository);
    const currentUser = buildUserProfile();

    repository.findById.mockResolvedValue(currentUser as never);
    repository.updateProfile.mockResolvedValue({
      ...currentUser,
      career: 'Software',
      referenceNeighborhood: 'Ficoa',
      termsAcceptedAt: new Date('2030-01-01T10:00:00.000Z'),
      privacyAcceptedAt: new Date('2030-01-01T10:00:00.000Z'),
      safetyRulesAcceptedAt: new Date('2030-01-01T10:00:00.000Z'),
      onboardingCompletedAt: new Date('2030-01-01T10:00:00.000Z'),
      onboardingStatus: UserOnboardingStatus.Complete,
      requiresOnboarding: false,
    } as never);

    await useCase.execute('user-1', {
      career: 'Software',
      referenceNeighborhood: 'Ficoa',
      acceptTerms: true,
      acceptPrivacy: true,
      acceptSafetyRules: true,
    });

    expect(repository.updateProfile).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        career: 'Software',
        referenceNeighborhood: 'Ficoa',
      }),
    );
    expect(repository.updateProfile.mock.calls[0]?.[1].termsAcceptedAt).toBeInstanceOf(Date);
    expect(repository.updateProfile.mock.calls[0]?.[1].privacyAcceptedAt).toBeInstanceOf(Date);
    expect(repository.updateProfile.mock.calls[0]?.[1].safetyRulesAcceptedAt).toBeInstanceOf(Date);
    expect(repository.updateProfile.mock.calls[0]?.[1].onboardingCompletedAt).toBeInstanceOf(Date);
  });
});
