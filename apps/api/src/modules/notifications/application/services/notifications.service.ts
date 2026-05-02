import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AppNotificationRecord } from '@saferidepro/shared-types';

import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import {
  CreateNotificationInput,
  NOTIFICATIONS_REPOSITORY,
  NotificationRecord,
  NotificationsRepository,
} from '../ports/notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly notificationsRepository: NotificationsRepository,
    @Optional()
    private readonly realtimeEventsService?: RealtimeEventsService,
  ) {}

  async notifyMembership(input: CreateNotificationInput): Promise<NotificationRecord> {
    const notification = await this.notificationsRepository.createNotification(input);

    this.realtimeEventsService?.publishNotificationCreated({
      institutionId: notification.institutionId,
      recipientMembershipId: notification.recipientMembershipId,
      notification: this.toRealtimeRecord(notification),
    });

    return notification;
  }

  async listForMembership(membershipId: string): Promise<NotificationRecord[]> {
    return this.notificationsRepository.listNotificationsByMembershipId(membershipId);
  }

  async countUnreadForMembership(membershipId: string): Promise<number> {
    return this.notificationsRepository.countUnreadByMembershipId(membershipId);
  }

  async markAsRead(
    membershipId: string,
    notificationId: string,
  ): Promise<NotificationRecord | null> {
    return this.notificationsRepository.markNotificationAsRead(
      membershipId,
      notificationId,
    );
  }

  async markAllAsRead(membershipId: string): Promise<number> {
    return this.notificationsRepository.markAllNotificationsAsRead(membershipId);
  }

  private toRealtimeRecord(notification: NotificationRecord): AppNotificationRecord {
    return {
      id: notification.id,
      institutionId: notification.institutionId,
      recipientMembershipId: notification.recipientMembershipId,
      actorUserId: notification.actorUserId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      actionUrl: notification.actionUrl,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
