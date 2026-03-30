import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { INSTITUTIONS_REPOSITORY } from './application/ports/institutions.repository';
import { CreateInstitutionUseCase } from './application/use-cases/create-institution.use-case';
import { ListActiveInstitutionsUseCase } from './application/use-cases/list-active-institutions.use-case';
import { UpdateInstitutionStatusUseCase } from './application/use-cases/update-institution-status.use-case';
import { PrismaInstitutionsRepository } from './infrastructure/repositories/prisma-institutions.repository';
import { InstitutionsController } from './presentation/controllers/institutions.controller';

@Module({
  imports: [AuthModule],
  controllers: [InstitutionsController],
  providers: [
    {
      provide: INSTITUTIONS_REPOSITORY,
      useClass: PrismaInstitutionsRepository,
    },
    ListActiveInstitutionsUseCase,
    CreateInstitutionUseCase,
    UpdateInstitutionStatusUseCase,
  ],
  exports: [INSTITUTIONS_REPOSITORY],
})
export class InstitutionsModule {}
