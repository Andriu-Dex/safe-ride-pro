import { AppNotificationType } from '@saferidepro/shared-types';

export const NOTIFICATIONS_REPOSITORY = Symbol('NOTIFICATIONS_REPOSITORY');

export type NotificationRecord = {
  id: string;
  institutionId: string;
  recipientMembershipId: string;
  actorUserId: string | null;
  type: AppNotificationType;
  title: string;
  body: string | null;
  actionUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export type CreateNotificationInput = {
  institutionId: string;
  recipientMembershipId: string;
  actorUserId?: string | null;
  type: AppNotificationType;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
};

export interface NotificationsRepository {
  createNotification(input: CreateNotificationInput): Promise<NotificationRecord>;
  listNotificationsByMembershipId(membershipId: string): Promise<NotificationRecord[]>;
  countUnreadByMembershipId(membershipId: string): Promise<number>;
  markNotificationAsRead(
    membershipId: string,
    notificationId: string,
  ): Promise<NotificationRecord | null>;
  markAllNotificationsAsRead(membershipId: string): Promise<number>;
}
