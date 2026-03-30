import { Global, Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { SANCTIONS_REPOSITORY } from './application/ports/sanctions.repository';
import { OperationalSanctionsService } from './application/services/operational-sanctions.service';
import { LiftOperationalSanctionUseCase } from './application/use-cases/lift-operational-sanction.use-case';
import { ListMySanctionAppealsUseCase } from './application/use-cases/list-my-sanction-appeals.use-case';
import { ListReviewableActiveSanctionsUseCase } from './application/use-cases/list-reviewable-active-sanctions.use-case';
import { ListReviewableSanctionAppealsUseCase } from './application/use-cases/list-reviewable-sanction-appeals.use-case';
import { ReviewSanctionAppealUseCase } from './application/use-cases/review-sanction-appeal.use-case';
import { SubmitSanctionAppealUseCase } from './application/use-cases/submit-sanction-appeal.use-case';
import { PrismaSanctionsRepository } from './infrastructure/repositories/prisma-sanctions.repository';
import { SanctionsController } from './presentation/controllers/sanctions.controller';

@Global()
@Module({
  imports: [AuditModule, AuthModule],
  controllers: [SanctionsController],
  providers: [
    {
      provide: SANCTIONS_REPOSITORY,
      useClass: PrismaSanctionsRepository,
    },
    OperationalSanctionsService,
    ListMySanctionAppealsUseCase,
    SubmitSanctionAppealUseCase,
    ListReviewableSanctionAppealsUseCase,
    ReviewSanctionAppealUseCase,
    ListReviewableActiveSanctionsUseCase,
    LiftOperationalSanctionUseCase,
  ],
  exports: [OperationalSanctionsService],
})
export class SanctionsModule {}
