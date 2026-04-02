import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DRIVER_DOCUMENT_STORAGE_SERVICE } from './application/ports/driver-document-storage.service';
import { DRIVERS_REPOSITORY } from './application/ports/drivers.repository';
import { GetDriverApplicationDocumentUseCase } from './application/use-cases/get-driver-application-document.use-case';
import { GetCurrentDriverProfileUseCase } from './application/use-cases/get-current-driver-profile.use-case';
import { ListReviewableDriverApplicationsUseCase } from './application/use-cases/list-reviewable-driver-applications.use-case';
import { ReviewDriverApplicationUseCase } from './application/use-cases/review-driver-application.use-case';
import { SubmitDriverApplicationUseCase } from './application/use-cases/submit-driver-application.use-case';
import { UploadDriverDocumentUseCase } from './application/use-cases/upload-driver-document.use-case';
import { PrismaDriversRepository } from './infrastructure/repositories/prisma-drivers.repository';
import { LocalDriverDocumentStorageService } from './infrastructure/storage/local-driver-document-storage.service';
import { DriversController } from './presentation/controllers/drivers.controller';

@Module({
  imports: [AuthModule],
  controllers: [DriversController],
  providers: [
    {
      provide: DRIVERS_REPOSITORY,
      useClass: PrismaDriversRepository,
    },
    {
      provide: DRIVER_DOCUMENT_STORAGE_SERVICE,
      useClass: LocalDriverDocumentStorageService,
    },
    GetCurrentDriverProfileUseCase,
    SubmitDriverApplicationUseCase,
    UploadDriverDocumentUseCase,
    ListReviewableDriverApplicationsUseCase,
    GetDriverApplicationDocumentUseCase,
    ReviewDriverApplicationUseCase,
  ],
  exports: [DRIVERS_REPOSITORY],
})
export class DriversModule {}
