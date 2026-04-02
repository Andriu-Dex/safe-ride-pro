import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PROFILE_IMAGE_STORAGE_SERVICE,
  ProfileImageStorageService,
} from '../ports/profile-image-storage.service';
import { USERS_REPOSITORY, UsersRepository } from '../ports/users.repository';

type UploadedProfilePhotoFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const MAX_PROFILE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROFILE_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class UploadCurrentUserProfilePhotoUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    @Inject(PROFILE_IMAGE_STORAGE_SERVICE)
    private readonly profileImageStorageService: ProfileImageStorageService,
  ) {}

  async execute(
    userId: string,
    file: UploadedProfilePhotoFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Selecciona una imagen para continuar.');
    }

    if (!ALLOWED_PROFILE_PHOTO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'La foto de perfil debe estar en formato JPG, PNG o WEBP.',
      );
    }

    if (file.size > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      throw new BadRequestException('La foto de perfil no puede superar los 5 MB.');
    }

    const currentPhotoRecord = await this.usersRepository.findProfilePhotoRecordById(userId);

    if (!currentPhotoRecord) {
      throw new NotFoundException('El usuario solicitado no existe.');
    }

    const storedImage = await this.profileImageStorageService.uploadProfileImage({
      fileName: file.originalname || 'profile-photo',
      mimeType: file.mimetype,
      content: file.buffer,
      previousImage: {
        url: currentPhotoRecord.profilePhotoUrl,
        storageProvider: currentPhotoRecord.profilePhotoStorageProvider as 'IMGUR' | null,
        storageKey: currentPhotoRecord.profilePhotoStorageKey,
      },
    });

    return this.usersRepository.updateProfilePhoto(userId, {
      profilePhotoUrl: storedImage.url,
      profilePhotoStorageProvider: storedImage.storageProvider,
      profilePhotoStorageKey: storedImage.storageKey,
    });
  }
}
