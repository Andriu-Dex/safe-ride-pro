import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { GetCurrentUserUseCase } from '../../application/use-cases/get-current-user.use-case';
import { ListAdminUserDirectoryUseCase } from '../../application/use-cases/list-admin-user-directory.use-case';
import { GetCurrentUserTrustSummaryUseCase } from '../../application/use-cases/get-current-user-trust-summary.use-case';
import { UpdateCurrentUserUseCase } from '../../application/use-cases/update-current-user.use-case';
import { UpdateAdminUserAccountStatusUseCase } from '../../application/use-cases/update-admin-user-account-status.use-case';
import { UploadCurrentUserProfilePhotoUseCase } from '../../application/use-cases/upload-current-user-profile-photo.use-case';
import { ListAdminUserDirectoryQueryDto } from '../dto/list-admin-user-directory.query.dto';
import { UpdateAdminUserAccountStatusRequestDto } from '../dto/update-admin-user-account-status.request.dto';
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
    private readonly listAdminUserDirectoryUseCase: ListAdminUserDirectoryUseCase,
    private readonly getCurrentUserTrustSummaryUseCase: GetCurrentUserTrustSummaryUseCase,
    private readonly updateCurrentUserUseCase: UpdateCurrentUserUseCase,
    private readonly updateAdminUserAccountStatusUseCase: UpdateAdminUserAccountStatusUseCase,
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

  @Get('admin/directory')
  listAdminUserDirectory(
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: ListAdminUserDirectoryQueryDto,
  ) {
    return this.listAdminUserDirectoryUseCase.execute({
      currentUser,
      institutionId: query.institutionId,
      query: query.query,
      accountStatus: query.accountStatus,
      driverVerificationStatus: query.driverVerificationStatus,
      limit: query.limit,
    });
  }

  @Patch('admin/:userId/account-status')
  updateAdminUserAccountStatus(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('userId') userId: string,
    @Body() body: UpdateAdminUserAccountStatusRequestDto,
  ) {
    return this.updateAdminUserAccountStatusUseCase.execute({
      currentUser,
      userId,
      accountStatus: body.accountStatus,
    });
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
