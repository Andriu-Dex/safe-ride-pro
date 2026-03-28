import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { GetCurrentDriverProfileUseCase } from '../../application/use-cases/get-current-driver-profile.use-case';
import { ReviewDriverApplicationUseCase } from '../../application/use-cases/review-driver-application.use-case';
import { SubmitDriverApplicationUseCase } from '../../application/use-cases/submit-driver-application.use-case';
import { ReviewDriverApplicationRequestDto } from '../dto/review-driver-application.request.dto';
import { SubmitDriverApplicationRequestDto } from '../dto/submit-driver-application.request.dto';

@Controller('drivers')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(
    private readonly getCurrentDriverProfileUseCase: GetCurrentDriverProfileUseCase,
    private readonly submitDriverApplicationUseCase: SubmitDriverApplicationUseCase,
    private readonly reviewDriverApplicationUseCase: ReviewDriverApplicationUseCase,
  ) {}

  @Get('me')
  getCurrentDriverProfile(@CurrentUser() currentUser: CurrentUserContext) {
    return this.getCurrentDriverProfileUseCase.execute(currentUser.id);
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