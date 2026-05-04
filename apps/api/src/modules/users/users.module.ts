import { Module } from '@nestjs/common';

import { PROFILE_IMAGE_STORAGE_SERVICE } from './application/ports/profile-image-storage.service';
import { AuthModule } from '../auth/auth.module';
import { USERS_REPOSITORY } from './application/ports/users.repository';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case';
import { ListAdminUserDirectoryUseCase } from './application/use-cases/list-admin-user-directory.use-case';
import { GetCurrentUserTrustSummaryUseCase } from './application/use-cases/get-current-user-trust-summary.use-case';
import { UpdateCurrentUserUseCase } from './application/use-cases/update-current-user.use-case';
import { UpdateAdminUserAccountStatusUseCase } from './application/use-cases/update-admin-user-account-status.use-case';
import { UploadCurrentUserProfilePhotoUseCase } from './application/use-cases/upload-current-user-profile-photo.use-case';
import { PrismaUsersRepository } from './infrastructure/repositories/prisma-users.repository';
import { ImgurProfileImageStorageService } from './infrastructure/storage/imgur-profile-image-storage.service';
import { UsersController } from './presentation/controllers/users.controller';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [
    {
      provide: USERS_REPOSITORY,
      useClass: PrismaUsersRepository,
    },
    {
      provide: PROFILE_IMAGE_STORAGE_SERVICE,
      useClass: ImgurProfileImageStorageService,
    },
    GetCurrentUserUseCase,
    ListAdminUserDirectoryUseCase,
    GetCurrentUserTrustSummaryUseCase,
    UpdateCurrentUserUseCase,
    UpdateAdminUserAccountStatusUseCase,
    UploadCurrentUserProfilePhotoUseCase,
  ],
  exports: [USERS_REPOSITORY],
})
export class UsersModule {}
