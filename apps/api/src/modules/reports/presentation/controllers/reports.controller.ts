import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CreateReportUseCase } from '../../application/use-cases/create-report.use-case';
import { GetReportEvidenceUseCase } from '../../application/use-cases/get-report-evidence.use-case';
import { ListMyReportsUseCase } from '../../application/use-cases/list-my-reports.use-case';
import { ListReviewableReportsUseCase } from '../../application/use-cases/list-reviewable-reports.use-case';
import { ReviewReportUseCase } from '../../application/use-cases/review-report.use-case';
import { UploadReportEvidenceUseCase } from '../../application/use-cases/upload-report-evidence.use-case';
import { CreateReportRequestDto } from '../dto/create-report.request.dto';
import { ListReviewableReportsQueryDto } from '../dto/list-reviewable-reports.query.dto';
import { ReviewReportRequestDto } from '../dto/review-report.request.dto';

type UploadedReportEvidenceFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly createReportUseCase: CreateReportUseCase,
    private readonly uploadReportEvidenceUseCase: UploadReportEvidenceUseCase,
    private readonly listMyReportsUseCase: ListMyReportsUseCase,
    private readonly listReviewableReportsUseCase: ListReviewableReportsUseCase,
    private readonly getReportEvidenceUseCase: GetReportEvidenceUseCase,
    private readonly reviewReportUseCase: ReviewReportUseCase,
  ) {}

  @Post('me/evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  uploadReportEvidence(
    @CurrentUser() currentUser: CurrentUserContext,
    @UploadedFile() file: UploadedReportEvidenceFile | undefined,
  ) {
    return this.uploadReportEvidenceUseCase.execute(currentUser.id, file);
  }

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

  @Get(':reportId/evidence')
  @Header('Cache-Control', 'no-store')
  async getReportEvidence(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('reportId') reportId: string,
  ) {
    const evidence = await this.getReportEvidenceUseCase.execute(currentUser, reportId);

    return new StreamableFile(evidence.content, {
      type: evidence.mimeType,
      disposition: `attachment; filename="${evidence.fileName}"`,
      length: evidence.content.length,
    });
  }

  @Patch(':reportId/review')
  reviewReport(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('reportId') reportId: string,
    @Body() body: ReviewReportRequestDto,
  ) {
    return this.reviewReportUseCase.execute(currentUser, {
      reportId,
      status: body.status,
      reviewNote: body.reviewNote,
    });
  }
}
