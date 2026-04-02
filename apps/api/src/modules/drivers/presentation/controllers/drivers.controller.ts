import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
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
import { GetDriverApplicationDocumentUseCase } from '../../application/use-cases/get-driver-application-document.use-case';
import { GetCurrentDriverProfileUseCase } from '../../application/use-cases/get-current-driver-profile.use-case';
import { ListReviewableDriverApplicationsUseCase } from '../../application/use-cases/list-reviewable-driver-applications.use-case';
import { ReviewDriverApplicationUseCase } from '../../application/use-cases/review-driver-application.use-case';
import { SubmitDriverApplicationUseCase } from '../../application/use-cases/submit-driver-application.use-case';
import { UploadDriverDocumentUseCase } from '../../application/use-cases/upload-driver-document.use-case';
import { DriverDocumentType } from '../../application/ports/drivers.repository';
import { ListReviewableDriverApplicationsQueryDto } from '../dto/list-reviewable-driver-applications.query.dto';
import { ReviewDriverApplicationRequestDto } from '../dto/review-driver-application.request.dto';
import { SubmitDriverApplicationRequestDto } from '../dto/submit-driver-application.request.dto';

type UploadedDriverDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('drivers')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(
    private readonly getCurrentDriverProfileUseCase: GetCurrentDriverProfileUseCase,
    private readonly submitDriverApplicationUseCase: SubmitDriverApplicationUseCase,
    private readonly uploadDriverDocumentUseCase: UploadDriverDocumentUseCase,
    private readonly listReviewableDriverApplicationsUseCase: ListReviewableDriverApplicationsUseCase,
    private readonly getDriverApplicationDocumentUseCase: GetDriverApplicationDocumentUseCase,
    private readonly reviewDriverApplicationUseCase: ReviewDriverApplicationUseCase,
  ) {}

  @Get('me')
  getCurrentDriverProfile(@CurrentUser() currentUser: CurrentUserContext) {
    return this.getCurrentDriverProfileUseCase.execute(currentUser.id);
  }

  @Post('me/documents/:documentType')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  uploadDriverDocument(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('documentType', new ParseEnumPipe(DriverDocumentType))
    documentType: DriverDocumentType,
    @UploadedFile() file: UploadedDriverDocumentFile | undefined,
  ) {
    return this.uploadDriverDocumentUseCase.execute(currentUser.id, documentType, file);
  }

  @Post('application')
  submitDriverApplication(
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: SubmitDriverApplicationRequestDto,
  ) {
    return this.submitDriverApplicationUseCase.execute({
      userId: currentUser.id,
      licenseTypeId: body.licenseTypeId,
      licenseNumber: body.licenseNumber,
      licenseExpiresAt: body.licenseExpiresAt,
      identityDocumentFileKey: body.identityDocumentFileKey,
      licenseDocumentFileKey: body.licenseDocumentFileKey,
    });
  }

  @Get('applications/inbox')
  listReviewableDriverApplications(
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: ListReviewableDriverApplicationsQueryDto,
  ) {
    return this.listReviewableDriverApplicationsUseCase.execute({
      currentUser,
      institutionId: query.institutionId,
      status: query.status,
      limit: query.limit,
    });
  }

  @Get('applications/:membershipId/documents/:documentType')
  @Header('Cache-Control', 'no-store')
  async getDriverApplicationDocument(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Param('documentType', new ParseEnumPipe(DriverDocumentType))
    documentType: DriverDocumentType,
  ) {
    const document = await this.getDriverApplicationDocumentUseCase.execute(
      currentUser,
      membershipId,
      documentType,
    );

    return new StreamableFile(document.content, {
      type: document.mimeType,
      disposition: `attachment; filename="${document.fileName}"`,
      length: document.content.length,
    });
  }

  @Patch('applications/:membershipId/review')
  reviewDriverApplication(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Body() body: ReviewDriverApplicationRequestDto,
  ) {
    return this.reviewDriverApplicationUseCase.execute(currentUser, {
      membershipId,
      decision: body.decision,
      reviewNotes: body.reviewNotes,
    });
  }
}
