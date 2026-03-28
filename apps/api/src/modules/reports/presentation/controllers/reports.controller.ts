import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CreateReportUseCase } from '../../application/use-cases/create-report.use-case';
import { ListMyReportsUseCase } from '../../application/use-cases/list-my-reports.use-case';
import { ListReviewableReportsUseCase } from '../../application/use-cases/list-reviewable-reports.use-case';
import { ReviewReportUseCase } from '../../application/use-cases/review-report.use-case';
import { CreateReportRequestDto } from '../dto/create-report.request.dto';
import { ListReviewableReportsQueryDto } from '../dto/list-reviewable-reports.query.dto';
import { ReviewReportRequestDto } from '../dto/review-report.request.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly createReportUseCase: CreateReportUseCase,
    private readonly listMyReportsUseCase: ListMyReportsUseCase,
    private readonly listReviewableReportsUseCase: ListReviewableReportsUseCase,
    private readonly reviewReportUseCase: ReviewReportUseCase,
  ) {}

  @Post()
  createReport(
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: CreateReportRequestDto,
  ) {
    return this.createReportUseCase.execute({
      userId: currentUser.id,
      tripId: body.tripId,
      reportedMembershipId: body.reportedMembershipId,
      reason: body.reason,
      description: body.description,
      evidenceFileKey: body.evidenceFileKey,
    });
  }

  @Get('me')
  listMyReports(@CurrentUser() currentUser: CurrentUserContext) {
    return this.listMyReportsUseCase.execute(currentUser.id);
  }

  @Get('inbox')
  listReviewableReports(
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: ListReviewableReportsQueryDto,
  ) {
    return this.listReviewableReportsUseCase.execute({
      currentUser,
      institutionId: query.institutionId,
      status: query.status,
      limit: query.limit,
    });
  }

  @Patch(':reportId/review')
  reviewReport(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() body: ReviewReportRequestDto,
  ) {
    return this.reviewReportUseCase.execute(currentUser, {
      reportId,
      status: body.status,
      reviewNote: body.reviewNote,
    });
  }
}
