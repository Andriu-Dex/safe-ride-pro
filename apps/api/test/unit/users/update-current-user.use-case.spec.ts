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
    findProfilePhotoRecordById: jest.fn(),
    updateProfile: jest.fn(),
    updateAccountStatus: jest.fn(),
    updateProfilePhoto: jest.fn(),
    getTrustSummary: jest.fn(),
    listAdminUserDirectory: jest.fn(),
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
  it('rejects explicit rejection of terms acceptance', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new UpdateCurrentUserUseCase(repository);
    repository.findById.mockResolvedValue(buildUserProfile() as never);

    await expect(
      useCase.execute('user-1', {
        acceptTerms: false,
      }),
    ).rejects.toThrow(new BadRequestException('Debes aceptar los terminos para continuar.'));

    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

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

  it('throws NotFoundException if the user does not exist', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new UpdateCurrentUserUseCase(repository);
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('non-existent', { fullName: 'Name' }),
    ).rejects.toThrow('El usuario solicitado no existe.');
  });

  it('throws BadRequestException if fullName is empty', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new UpdateCurrentUserUseCase(repository);
    repository.findById.mockResolvedValue(buildUserProfile() as never);

    await expect(
      useCase.execute('user-1', { fullName: '   ' }),
    ).rejects.toThrow('Ingresa tu nombre completo para continuar.');
  });

  it('throws BadRequestException if career is less than minimum length', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new UpdateCurrentUserUseCase(repository);
    repository.findById.mockResolvedValue(buildUserProfile() as never);

    await expect(
      useCase.execute('user-1', { career: 'ab' }),
    ).rejects.toThrow('Ingresa tu carrera con al menos 3 caracteres.');
  });

  it('throws BadRequestException if referenceNeighborhood is empty or too short', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new UpdateCurrentUserUseCase(repository);
    repository.findById.mockResolvedValue(buildUserProfile() as never);

    await expect(
      useCase.execute('user-1', { referenceNeighborhood: '  ' }),
    ).rejects.toThrow('Ingresa tu zona o barrio de referencia.');
  });

  it('throws BadRequestException if privacy policy is explicitly rejected', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new UpdateCurrentUserUseCase(repository);
    repository.findById.mockResolvedValue(buildUserProfile() as never);

    await expect(
      useCase.execute('user-1', { acceptPrivacy: false }),
    ).rejects.toThrow('Debes aceptar la politica de privacidad para continuar.');
  });

  it('throws BadRequestException if safety rules are explicitly rejected', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new UpdateCurrentUserUseCase(repository);
    repository.findById.mockResolvedValue(buildUserProfile() as never);

    await expect(
      useCase.execute('user-1', { acceptSafetyRules: false }),
    ).rejects.toThrow('Debes aceptar las reglas de seguridad para continuar.');
  });

  it('does not update date if it is already accepted (covers areDatesEqual line 24)', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new UpdateCurrentUserUseCase(repository);
    const acceptedDate = new Date('2030-01-01T10:00:00.000Z');
    const userProfile = {
      ...buildUserProfile(),
      career: 'Software',
      referenceNeighborhood: 'Ficoa',
      termsAcceptedAt: acceptedDate,
      privacyAcceptedAt: acceptedDate,
      safetyRulesAcceptedAt: acceptedDate,
      onboardingCompletedAt: acceptedDate,
    };
    repository.findById.mockResolvedValue(userProfile as never);
    repository.updateProfile.mockResolvedValue(userProfile as never);

    await useCase.execute('user-1', {
      acceptTerms: true,
      acceptPrivacy: true,
      acceptSafetyRules: true,
    });

    expect(repository.updateProfile).toHaveBeenCalledWith('user-1', {
      fullName: undefined,
      career: undefined,
      phone: undefined,
      referenceNeighborhood: undefined,
      profilePhotoUrl: undefined,
      termsAcceptedAt: undefined,
      privacyAcceptedAt: undefined,
      safetyRulesAcceptedAt: undefined,
      onboardingCompletedAt: undefined,
    });
  });

  it('normalizes empty phone and profilePhotoUrl strings to null', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new UpdateCurrentUserUseCase(repository);
    repository.findById.mockResolvedValue(buildUserProfile() as never);

    await useCase.execute('user-1', {
      phone: '   ',
      profilePhotoUrl: '   ',
    });

    expect(repository.updateProfile).toHaveBeenCalledWith('user-1', expect.objectContaining({
      phone: null,
      profilePhotoUrl: null,
    }));
  });
});
