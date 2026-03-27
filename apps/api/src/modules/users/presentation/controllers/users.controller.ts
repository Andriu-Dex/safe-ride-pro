import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { GetCurrentUserUseCase } from '../../application/use-cases/get-current-user.use-case';
import { UpdateCurrentUserUseCase } from '../../application/use-cases/update-current-user.use-case';
import { UpdateCurrentUserRequestDto } from '../dto/update-current-user.request.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly updateCurrentUserUseCase: UpdateCurrentUserUseCase,
  ) {}

  @Get('me')
  getCurrentUser(@CurrentUser() currentUser: CurrentUserContext) {
    return this.getCurrentUserUseCase.execute(currentUser.id);
  }

  @Patch('me')
  updateCurrentUser(
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: UpdateCurrentUserRequestDto,
  ) {
    return this.updateCurrentUserUseCase.execute(currentUser.id, body);
  }
}
