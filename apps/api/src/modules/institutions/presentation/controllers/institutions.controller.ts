import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CreateInstitutionUseCase } from '../../application/use-cases/create-institution.use-case';
import { ListActiveInstitutionsUseCase } from '../../application/use-cases/list-active-institutions.use-case';
import { CreateInstitutionRequestDto } from '../dto/create-institution.request.dto';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../../auth/presentation/guards/super-admin.guard';

@Controller('institutions')
export class InstitutionsController {
  constructor(
    private readonly listActiveInstitutionsUseCase: ListActiveInstitutionsUseCase,
    private readonly createInstitutionUseCase: CreateInstitutionUseCase,
  ) {}

  @Get()
  listActive() {
    return this.listActiveInstitutionsUseCase.execute();
  }

  @Post()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  create(@Body() body: CreateInstitutionRequestDto) {
    return this.createInstitutionUseCase.execute(body);
  }
}
