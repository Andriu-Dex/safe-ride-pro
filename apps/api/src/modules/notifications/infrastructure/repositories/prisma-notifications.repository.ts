import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppNotificationType } from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  CreateNotificationInput,
  NotificationRecord,
  NotificationsRepository,
} from '../../application/ports/notifications.repository';

@Injectable()
export class PrismaNotificationsRepository implements NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(input: CreateNotificationInput): Promise<NotificationRecord> {
    try {
      const notification = await this.prisma.appNotification.create({
        data: {
          institutionId: input.institutionId,
          recipientMembershipId: input.recipientMembershipId,
          actorUserId: input.actorUserId ?? null,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          actionUrl: input.actionUrl ?? null,
        },
      });

      return this.mapNotification(notification);
    } catch (error) {
      if (this.isMissingNotificationsTable(error)) {
        return {
          id: 'notifications-disabled',
          institutionId: input.institutionId,
          recipientMembershipId: input.recipientMembershipId,
          actorUserId: input.actorUserId ?? null,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          actionUrl: input.actionUrl ?? null,
          readAt: null,
          createdAt: new Date(),
        };
      }

      throw error;
    }
  }

  async listNotificationsByMembershipId(membershipId: string): Promise<NotificationRecord[]> {
    try {
      const notifications = await this.prisma.appNotification.findMany({
        where: { recipientMembershipId: membershipId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 40,
      });

      return notifications.map((notification) => this.mapNotification(notification));
    } catch (error) {
      if (this.isMissingNotificationsTable(error)) {
        return [];
      }

      throw error;
    }
  }

  async countUnreadByMembershipId(membershipId: string): Promise<number> {
    try {
      return await this.prisma.appNotification.count({
        where: {
          recipientMembershipId: membershipId,
          readAt: null,
        },
      });
    } catch (error) {
      if (this.isMissingNotificationsTable(error)) {
        return 0;
      }

      throw error;
    }
  }

  async markNotificationAsRead(
    membershipId: string,
    notificationId: string,
  ): Promise<NotificationRecord | null> {
    try {
      const result = await this.prisma.appNotification.updateMany({
        where: {
          id: notificationId,
          recipientMembershipId: membershipId,
        },
        data: {
          readAt: new Date(),
        },
      });

      if (result.count !== 1) {
        return null;
      }

      const notification = await this.prisma.appNotification.findUnique({
        where: { id: notificationId },
      });

      return notification ? this.mapNotification(notification) : null;
    } catch (error) {
      if (this.isMissingNotificationsTable(error)) {
        return null;
      }

      throw error;
    }
  }

  async markAllNotificationsAsRead(membershipId: string): Promise<number> {
    try {
      const result = await this.prisma.appNotification.updateMany({
        where: {
          recipientMembershipId: membershipId,
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      return result.count;
    } catch (error) {
      if (this.isMissingNotificationsTable(error)) {
        return 0;
      }

      throw error;
    }
  }

  private isMissingNotificationsTable(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2021'
    );
  }

  private mapNotification(notification: {
    id: string;
    institutionId: string;
    recipientMembershipId: string;
    actorUserId: string | null;
    type: string;
    title: string;
    body: string | null;
    actionUrl: string | null;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationRecord {
    return {
      id: notification.id,
      institutionId: notification.institutionId,
      recipientMembershipId: notification.recipientMembershipId,
      actorUserId: notification.actorUserId,
      type: notification.type as AppNotificationType,
      title: notification.title,
      body: notification.body,
      actionUrl: notification.actionUrl,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
