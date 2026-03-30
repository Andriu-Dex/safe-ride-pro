import { Global, Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { SANCTIONS_REPOSITORY } from './application/ports/sanctions.repository';
import { OperationalSanctionsService } from './application/services/operational-sanctions.service';
import { PrismaSanctionsRepository } from './infrastructure/repositories/prisma-sanctions.repository';

@Global()
@Module({
  imports: [AuditModule],
  providers: [
    {
      provide: SANCTIONS_REPOSITORY,
      useClass: PrismaSanctionsRepository,
    },
    OperationalSanctionsService,
  ],
  exports: [OperationalSanctionsService],
})
export class SanctionsModule {}
