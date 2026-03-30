import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CreateInstitutionUseCase } from '../../application/use-cases/create-institution.use-case';
import { ListActiveInstitutionsUseCase } from '../../application/use-cases/list-active-institutions.use-case';
import { UpdateInstitutionStatusUseCase } from '../../application/use-cases/update-institution-status.use-case';
import { CreateInstitutionRequestDto } from '../dto/create-institution.request.dto';
import { UpdateInstitutionStatusRequestDto } from '../dto/update-institution-status.request.dto';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../../auth/presentation/guards/super-admin.guard';

@Controller('institutions')
export class InstitutionsController {
  constructor(
    private readonly listActiveInstitutionsUseCase: ListActiveInstitutionsUseCase,
    private readonly createInstitutionUseCase: CreateInstitutionUseCase,
    private readonly updateInstitutionStatusUseCase: UpdateInstitutionStatusUseCase,
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

  @Patch(':institutionId/status')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  updateStatus(
    @Param('institutionId') institutionId: string,
    @Body() body: UpdateInstitutionStatusRequestDto,
  ) {
    return this.updateInstitutionStatusUseCase.execute({
      institutionId,
      isActive: body.isActive,
    });
  }
}
