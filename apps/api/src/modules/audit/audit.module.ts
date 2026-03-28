import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AUDIT_REPOSITORY } from './application/ports/audit.repository';
import { AuditService } from './application/services/audit.service';
import { ListAuditEventsUseCase } from './application/use-cases/list-audit-events.use-case';
import { PrismaAuditRepository } from './infrastructure/repositories/prisma-audit.repository';
import { AuditController } from './presentation/controllers/audit.controller';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [
    {
      provide: AUDIT_REPOSITORY,
      useClass: PrismaAuditRepository,
    },
    AuditService,
    ListAuditEventsUseCase,
  ],
  exports: [AuditService],
})
export class AuditModule {}