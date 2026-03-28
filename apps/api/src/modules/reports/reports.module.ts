import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { REPORTS_REPOSITORY } from './application/ports/reports.repository';
import { CreateReportUseCase } from './application/use-cases/create-report.use-case';
import { ListMyReportsUseCase } from './application/use-cases/list-my-reports.use-case';
import { ListReviewableReportsUseCase } from './application/use-cases/list-reviewable-reports.use-case';
import { ReviewReportUseCase } from './application/use-cases/review-report.use-case';
import { PrismaReportsRepository } from './infrastructure/repositories/prisma-reports.repository';
import { ReportsController } from './presentation/controllers/reports.controller';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [
    {
      provide: REPORTS_REPOSITORY,
      useClass: PrismaReportsRepository,
    },
    CreateReportUseCase,
    ListMyReportsUseCase,
    ListReviewableReportsUseCase,
    ReviewReportUseCase,
  ],
})
export class ReportsModule {}
