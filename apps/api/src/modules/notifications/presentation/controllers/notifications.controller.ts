import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { NotificationsService } from '../../application/services/notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async listNotifications(@CurrentUser() currentUser: CurrentUserContext) {
    const membershipId = this.getDefaultMembershipId(currentUser);
    const items = await this.notificationsService.listForMembership(membershipId);

    return { items };
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() currentUser: CurrentUserContext) {
    const membershipId = this.getDefaultMembershipId(currentUser);
    const count = await this.notificationsService.countUnreadForMembership(membershipId);

    return { count };
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() currentUser: CurrentUserContext) {
    const membershipId = this.getDefaultMembershipId(currentUser);
    const updatedCount = await this.notificationsService.markAllAsRead(membershipId);

    return { updatedCount };
  }

  @Patch(':notificationId/read')
  async markAsRead(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('notificationId') notificationId: string,
  ) {
    const membershipId = this.getDefaultMembershipId(currentUser);
    const notification = await this.notificationsService.markAsRead(
      membershipId,
      notificationId,
    );

    if (!notification) {
      throw new NotFoundException('La notificacion no existe.');
    }

    return { notification };
  }

  private getDefaultMembershipId(currentUser: CurrentUserContext): string {
    const membership = currentUser.memberships
      .filter(
        (candidate) =>
          candidate.membershipStatus === MembershipStatus.Active &&
          candidate.institutionIsActive !== false,
      )
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))[0];

    if (!membership) {
      throw new NotFoundException('No encontramos una membresia activa.');
    }

    return membership.id;
  }
}
