import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { GetCurrentUserUseCase } from '../../application/use-cases/get-current-user.use-case';
import { GetCurrentUserTrustSummaryUseCase } from '../../application/use-cases/get-current-user-trust-summary.use-case';
import { UpdateCurrentUserUseCase } from '../../application/use-cases/update-current-user.use-case';
import { UploadCurrentUserProfilePhotoUseCase } from '../../application/use-cases/upload-current-user-profile-photo.use-case';
import { UpdateCurrentUserRequestDto } from '../dto/update-current-user.request.dto';

type UploadedProfilePhotoFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly getCurrentUserTrustSummaryUseCase: GetCurrentUserTrustSummaryUseCase,
    private readonly updateCurrentUserUseCase: UpdateCurrentUserUseCase,
    private readonly uploadCurrentUserProfilePhotoUseCase: UploadCurrentUserProfilePhotoUseCase,
  ) {}

  @Get('me')
  getCurrentUser(@CurrentUser() currentUser: CurrentUserContext) {
    return this.getCurrentUserUseCase.execute(currentUser.id);
  }

  @Get('me/trust-summary')
  getCurrentUserTrustSummary(@CurrentUser() currentUser: CurrentUserContext) {
    return this.getCurrentUserTrustSummaryUseCase.execute(currentUser.id);
  }

  @Patch('me')
  updateCurrentUser(
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: UpdateCurrentUserRequestDto,
  ) {
    return this.updateCurrentUserUseCase.execute(currentUser.id, body);
  }

  @Post('me/profile-photo')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadCurrentUserProfilePhoto(
    @CurrentUser() currentUser: CurrentUserContext,
    @UploadedFile() file: UploadedProfilePhotoFile | undefined,
  ) {
    return this.uploadCurrentUserProfilePhotoUseCase.execute(currentUser.id, file);
  }
}
