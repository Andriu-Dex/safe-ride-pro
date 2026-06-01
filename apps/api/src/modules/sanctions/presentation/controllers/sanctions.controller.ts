import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import type { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { LiftOperationalSanctionUseCase } from '../../application/use-cases/lift-operational-sanction.use-case';
import { ListMySanctionAppealsUseCase } from '../../application/use-cases/list-my-sanction-appeals.use-case';
import { ListReviewableActiveSanctionsUseCase } from '../../application/use-cases/list-reviewable-active-sanctions.use-case';
import { ListReviewableSanctionAppealsUseCase } from '../../application/use-cases/list-reviewable-sanction-appeals.use-case';
import { ReviewSanctionAppealUseCase } from '../../application/use-cases/review-sanction-appeal.use-case';
import { SubmitSanctionAppealUseCase } from '../../application/use-cases/submit-sanction-appeal.use-case';
import { LiftOperationalSanctionRequestDto } from '../dto/lift-operational-sanction.request.dto';
import { ListReviewableActiveSanctionsQueryDto } from '../dto/list-reviewable-active-sanctions.query.dto';
import { ListReviewableSanctionAppealsQueryDto } from '../dto/list-reviewable-sanction-appeals.query.dto';
import { ReviewSanctionAppealRequestDto } from '../dto/review-sanction-appeal.request.dto';
import { SubmitSanctionAppealRequestDto } from '../dto/submit-sanction-appeal.request.dto';

@Controller('sanctions')
@UseGuards(JwtAuthGuard)
export class SanctionsController {
  constructor(
    private readonly listMySanctionAppealsUseCase: ListMySanctionAppealsUseCase,
    private readonly submitSanctionAppealUseCase: SubmitSanctionAppealUseCase,
    private readonly listReviewableSanctionAppealsUseCase: ListReviewableSanctionAppealsUseCase,
    private readonly reviewSanctionAppealUseCase: ReviewSanctionAppealUseCase,
    private readonly listReviewableActiveSanctionsUseCase: ListReviewableActiveSanctionsUseCase,
    private readonly liftOperationalSanctionUseCase: LiftOperationalSanctionUseCase,
  ) {}

  @Get('appeals/me')
  listMyAppeals(@CurrentUser() currentUser: CurrentUserContext) {
    return this.listMySanctionAppealsUseCase.execute(currentUser);
  }

  @Post(':sanctionId/appeals')
  submitAppeal(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('sanctionId') sanctionId: string,
    @Body() body: SubmitSanctionAppealRequestDto,
  ) {
    return this.submitSanctionAppealUseCase.execute(currentUser, {
      sanctionId,
      reason: body.reason,
    });
  }

  @Get('appeals/inbox')
  listReviewableAppeals(
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: ListReviewableSanctionAppealsQueryDto,
  ) {
    return this.listReviewableSanctionAppealsUseCase.execute({
      currentUser,
      institutionId: query.institutionId,
      status: query.status,
      limit: query.limit,
    });
  }

  @Patch('appeals/:appealId/review')
  reviewAppeal(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('appealId') appealId: string,
    @Body() body: ReviewSanctionAppealRequestDto,
  ) {
    return this.reviewSanctionAppealUseCase.execute(currentUser, {
      appealId,
      status: body.status,
      reviewNote: body.reviewNote,
    });
  }

  @Get('inbox')
  listReviewableActiveSanctions(
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: ListReviewableActiveSanctionsQueryDto,
  ) {
    return this.listReviewableActiveSanctionsUseCase.execute({
      currentUser,
      institutionId: query.institutionId,
      userId: query.userId,
      limit: query.limit,
    });
  }

  @Patch(':sanctionId/lift')
  liftSanction(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('sanctionId') sanctionId: string,
    @Body() body: LiftOperationalSanctionRequestDto,
  ) {
    return this.liftOperationalSanctionUseCase.execute(currentUser, {
      sanctionId,
      reviewNote: body.reviewNote,
    });
  }
}
