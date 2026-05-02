import { apiRequest } from '../../../lib/api-client';
import type { NotificationRecord } from '../types/notification';

type NotificationListResponse = {
  items: NotificationRecord[];
};

type NotificationCountResponse = {
  count: number;
};

export async function listNotifications(accessToken: string): Promise<NotificationRecord[]> {
  const response = await apiRequest<NotificationListResponse>('/notifications', {
    accessToken,
  });

  return response.items;
}

export async function getUnreadNotificationCount(accessToken: string): Promise<number> {
  const response = await apiRequest<NotificationCountResponse>('/notifications/unread-count', {
    accessToken,
  });

  return response.count;
}

export async function markNotificationAsRead(
  accessToken: string,
  notificationId: string,
): Promise<void> {
  await apiRequest(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
    accessToken,
    body: {},
  });
}

export async function markAllNotificationsAsRead(accessToken: string): Promise<void> {
  await apiRequest('/notifications/read-all', {
    method: 'PATCH',
    accessToken,
    body: {},
  });
}
