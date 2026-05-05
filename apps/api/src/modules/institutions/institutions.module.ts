import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { INSTITUTIONS_REPOSITORY } from './application/ports/institutions.repository';
import { CreateInstitutionUseCase } from './application/use-cases/create-institution.use-case';
import { GetInstitutionSettingsUseCase } from './application/use-cases/get-institution-settings.use-case';
import { ListActiveInstitutionsUseCase } from './application/use-cases/list-active-institutions.use-case';
import { UpdateInstitutionSettingsUseCase } from './application/use-cases/update-institution-settings.use-case';
import { UpdateInstitutionStatusUseCase } from './application/use-cases/update-institution-status.use-case';
import { PrismaInstitutionsRepository } from './infrastructure/repositories/prisma-institutions.repository';
import { InstitutionsController } from './presentation/controllers/institutions.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [InstitutionsController],
  providers: [
    {
      provide: INSTITUTIONS_REPOSITORY,
      useClass: PrismaInstitutionsRepository,
    },
    ListActiveInstitutionsUseCase,
    CreateInstitutionUseCase,
    UpdateInstitutionStatusUseCase,
    GetInstitutionSettingsUseCase,
    UpdateInstitutionSettingsUseCase,
  ],
  exports: [INSTITUTIONS_REPOSITORY],
})
export class InstitutionsModule {}
