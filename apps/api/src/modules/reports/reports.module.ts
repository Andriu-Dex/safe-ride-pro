import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { REPORT_EVIDENCE_STORAGE_SERVICE } from './application/ports/report-evidence-storage.service';
import { REPORTS_REPOSITORY } from './application/ports/reports.repository';
import { CreateReportUseCase } from './application/use-cases/create-report.use-case';
import { GetReportEvidenceUseCase } from './application/use-cases/get-report-evidence.use-case';
import { ListMyReportsUseCase } from './application/use-cases/list-my-reports.use-case';
import { ListReviewableReportsUseCase } from './application/use-cases/list-reviewable-reports.use-case';
import { ReviewReportUseCase } from './application/use-cases/review-report.use-case';
import { UploadReportEvidenceUseCase } from './application/use-cases/upload-report-evidence.use-case';
import { PrismaReportsRepository } from './infrastructure/repositories/prisma-reports.repository';
import { LocalReportEvidenceStorageService } from './infrastructure/storage/local-report-evidence-storage.service';
import { ReportsController } from './presentation/controllers/reports.controller';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [
    {
      provide: REPORTS_REPOSITORY,
      useClass: PrismaReportsRepository,
    },
    {
      provide: REPORT_EVIDENCE_STORAGE_SERVICE,
      useClass: LocalReportEvidenceStorageService,
    },
    CreateReportUseCase,
    UploadReportEvidenceUseCase,
    ListMyReportsUseCase,
    ListReviewableReportsUseCase,
    GetReportEvidenceUseCase,
    ReviewReportUseCase,
  ],
})
export class ReportsModule {}
