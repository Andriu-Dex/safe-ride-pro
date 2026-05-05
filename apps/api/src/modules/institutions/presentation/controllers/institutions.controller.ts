import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { CreateInstitutionUseCase } from '../../application/use-cases/create-institution.use-case';
import { GetInstitutionSettingsUseCase } from '../../application/use-cases/get-institution-settings.use-case';
import { ListActiveInstitutionsUseCase } from '../../application/use-cases/list-active-institutions.use-case';
import { UpdateInstitutionSettingsUseCase } from '../../application/use-cases/update-institution-settings.use-case';
import { UpdateInstitutionStatusUseCase } from '../../application/use-cases/update-institution-status.use-case';
import { CreateInstitutionRequestDto } from '../dto/create-institution.request.dto';
import { InstitutionSettingsQueryDto } from '../dto/institution-settings.query.dto';
import { UpdateInstitutionStatusRequestDto } from '../dto/update-institution-status.request.dto';
import { UpdateInstitutionSettingsRequestDto } from '../dto/update-institution-settings.request.dto';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../../auth/presentation/guards/super-admin.guard';

@Controller('institutions')
export class InstitutionsController {
  constructor(
    private readonly listActiveInstitutionsUseCase: ListActiveInstitutionsUseCase,
    private readonly createInstitutionUseCase: CreateInstitutionUseCase,
    private readonly updateInstitutionStatusUseCase: UpdateInstitutionStatusUseCase,
    private readonly getInstitutionSettingsUseCase: GetInstitutionSettingsUseCase,
    private readonly updateInstitutionSettingsUseCase: UpdateInstitutionSettingsUseCase,
  ) {}

  @Get()
  listActive() {
    return this.listActiveInstitutionsUseCase.execute();
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  getSettings(
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: InstitutionSettingsQueryDto,
  ) {
    return this.getInstitutionSettingsUseCase.execute(
      currentUser,
      query.institutionId,
    );
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

  @Patch('settings')
  @UseGuards(JwtAuthGuard)
  updateSettings(
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: InstitutionSettingsQueryDto,
    @Body() body: UpdateInstitutionSettingsRequestDto,
  ) {
    return this.updateInstitutionSettingsUseCase.execute(currentUser, {
      institutionId: query.institutionId,
      allowCashPayments: body.allowCashPayments,
      allowPaypalPayments: body.allowPaypalPayments,
      termsDocumentUrl: body.termsDocumentUrl,
      privacyPolicyUrl: body.privacyPolicyUrl,
      safetyRulesTitle: body.safetyRulesTitle,
      safetyRulesSummary: body.safetyRulesSummary,
      safetyRulesBody: body.safetyRulesBody,
    });
  }
}
