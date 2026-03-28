import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CreateRatingUseCase } from '../../application/use-cases/create-rating.use-case';
import { ListMyRatingsUseCase } from '../../application/use-cases/list-my-ratings.use-case';
import { CreateRatingRequestDto } from '../dto/create-rating.request.dto';

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(
    private readonly createRatingUseCase: CreateRatingUseCase,
    private readonly listMyRatingsUseCase: ListMyRatingsUseCase,
  ) {}

  @Post()
  createRating(
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: CreateRatingRequestDto,
  ) {
    return this.createRatingUseCase.execute({
      userId: currentUser.id,
      tripId: body.tripId,
      targetMembershipId: body.targetMembershipId,
      score: body.score,
      comment: body.comment,
    });
  }

  @Get('me')
  listMyRatings(@CurrentUser() currentUser: CurrentUserContext) {
    return this.listMyRatingsUseCase.execute(currentUser.id);
  }
}