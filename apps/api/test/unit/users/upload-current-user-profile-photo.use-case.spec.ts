import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { ProfileImageStorageService } from '../../../src/modules/users/application/ports/profile-image-storage.service';
import type { UsersRepository } from '../../../src/modules/users/application/ports/users.repository';
import { UploadCurrentUserProfilePhotoUseCase } from '../../../src/modules/users/application/use-cases/upload-current-user-profile-photo.use-case';

function createUsersRepositoryMock(): jest.Mocked<UsersRepository> {
  return {
    findById: jest.fn(),
    findProfilePhotoRecordById: jest.fn(),
    updateProfile: jest.fn(),
    updateProfilePhoto: jest.fn(),
    getTrustSummary: jest.fn(),
  };
}

function createProfileImageStorageServiceMock(): jest.Mocked<ProfileImageStorageService> {
  return {
    uploadProfileImage: jest.fn(),
  };
}

describe('UploadCurrentUserProfilePhotoUseCase', () => {
  it('rejects unsupported mime types', async () => {
    const repository = createUsersRepositoryMock();
    const storageService = createProfileImageStorageServiceMock();
    const useCase = new UploadCurrentUserProfilePhotoUseCase(repository, storageService);

    await expect(
      useCase.execute('user-1', {
        originalname: 'avatar.gif',
        mimetype: 'image/gif',
        size: 1024,
        buffer: Buffer.from('gif'),
      }),
    ).rejects.toThrow(
      new BadRequestException('La foto de perfil debe estar en formato JPG, PNG o WEBP.'),
    );

    expect(repository.findProfilePhotoRecordById).not.toHaveBeenCalled();
  });

  it('uploads a valid image and persists the returned metadata', async () => {
    const repository = createUsersRepositoryMock();
    const storageService = createProfileImageStorageServiceMock();
    const useCase = new UploadCurrentUserProfilePhotoUseCase(repository, storageService);
    const fileBuffer = Buffer.from('png');

    repository.findProfilePhotoRecordById.mockResolvedValue({
      userId: 'user-1',
      profilePhotoUrl: 'https://i.imgur.com/old-avatar.png',
      profilePhotoStorageProvider: 'IMGUR',
      profilePhotoStorageKey: 'old-delete-hash',
    });
    storageService.uploadProfileImage.mockResolvedValue({
      url: 'https://i.imgur.com/new-avatar.png',
      storageProvider: 'IMGUR',
      storageKey: 'new-delete-hash',
    });
    repository.updateProfilePhoto.mockResolvedValue({
      id: 'user-1',
      email: 'user@uta.edu.ec',
      fullName: 'Usuario Uno',
      career: 'Software',
      phone: '0999999999',
      referenceNeighborhood: 'Ficoa',
      documentType: 'NATIONAL_ID',
      documentNumber: '1710034065',
      profilePhotoUrl: 'https://i.imgur.com/new-avatar.png',
      globalRole: 'USER' as never,
      accountStatus: 'ACTIVE' as never,
      emailVerifiedAt: new Date('2030-01-01T08:00:00.000Z'),
      termsAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      privacyAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      safetyRulesAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      onboardingCompletedAt: new Date('2030-01-01T08:00:00.000Z'),
      onboardingStatus: 'COMPLETE' as never,
      missingOnboardingRequirements: [],
      requiresOnboarding: false,
      memberships: [],
    });

    await useCase.execute('user-1', {
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: 4096,
      buffer: fileBuffer,
    });

    expect(storageService.uploadProfileImage).toHaveBeenCalledWith({
      fileName: 'avatar.png',
      mimeType: 'image/png',
      content: fileBuffer,
      previousImage: {
        url: 'https://i.imgur.com/old-avatar.png',
        storageProvider: 'IMGUR',
        storageKey: 'old-delete-hash',
      },
    });
    expect(repository.updateProfilePhoto).toHaveBeenCalledWith('user-1', {
      profilePhotoUrl: 'https://i.imgur.com/new-avatar.png',
      profilePhotoStorageProvider: 'IMGUR',
      profilePhotoStorageKey: 'new-delete-hash',
    });
  });

  it('fails when the user does not exist', async () => {
    const repository = createUsersRepositoryMock();
    const storageService = createProfileImageStorageServiceMock();
    const useCase = new UploadCurrentUserProfilePhotoUseCase(repository, storageService);

    repository.findProfilePhotoRecordById.mockResolvedValue(null);

    await expect(
      useCase.execute('user-1', {
        originalname: 'avatar.png',
        mimetype: 'image/png',
        size: 4096,
        buffer: Buffer.from('png'),
      }),
    ).rejects.toThrow(new NotFoundException('El usuario solicitado no existe.'));
  });
});
