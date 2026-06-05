import { AppNotificationType } from '@saferidepro/shared-types';

import type { NotificationsRepository } from '../../../src/modules/notifications/application/ports/notifications.repository';
import { NotificationsService } from '../../../src/modules/notifications/application/services/notifications.service';
import type { RealtimeEventsService } from '../../../src/modules/realtime/application/services/realtime-events.service';

type RealtimeEventsServiceMock = Pick<
  RealtimeEventsService,
  'publishNotificationCreated'
>;

function createNotificationsRepositoryMock(): jest.Mocked<NotificationsRepository> {
  return {
    createNotification: jest.fn(),
    listNotificationsByMembershipId: jest.fn(),
    countUnreadByMembershipId: jest.fn(),
    markNotificationAsRead: jest.fn(),
    markAllNotificationsAsRead: jest.fn(),
  };
}

function createRealtimeEventsServiceMock(): jest.Mocked<RealtimeEventsServiceMock> {
  return {
    publishNotificationCreated: jest.fn(),
  };
}

describe('NotificationsService', () => {
  it('creates a notification and publishes the realtime payload', async () => {
    const repository = createNotificationsRepositoryMock();
    const realtime = createRealtimeEventsServiceMock();
    const service = new NotificationsService(
      repository,
      realtime as unknown as RealtimeEventsService,
    );
    const createdAt = new Date('2030-01-01T10:00:00.000Z');

    repository.createNotification.mockResolvedValue({
      id: 'notification-1',
      institutionId: 'institution-1',
      recipientMembershipId: 'membership-1',
      actorUserId: 'user-1',
      type: AppNotificationType.PaymentConfirmed,
      title: 'Pago confirmado',
      body: 'El conductor confirmo el pago.',
      actionUrl: '/viajes',
      readAt: null,
      createdAt,
    });

    const notification = await service.notifyMembership({
      institutionId: 'institution-1',
      recipientMembershipId: 'membership-1',
      actorUserId: 'user-1',
      type: AppNotificationType.PaymentConfirmed,
      title: 'Pago confirmado',
      body: 'El conductor confirmo el pago.',
      actionUrl: '/viajes',
    });

    expect(notification.id).toBe('notification-1');
    expect(realtime.publishNotificationCreated).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      recipientMembershipId: 'membership-1',
      notification: {
        id: 'notification-1',
        institutionId: 'institution-1',
        recipientMembershipId: 'membership-1',
        actorUserId: 'user-1',
        type: AppNotificationType.PaymentConfirmed,
        title: 'Pago confirmado',
        body: 'El conductor confirmo el pago.',
        actionUrl: '/viajes',
        readAt: null,
        createdAt: createdAt.toISOString(),
      },
    });
  });

  it('delegates list, unread count and read actions to the repository', async () => {
    const repository = createNotificationsRepositoryMock();
    const service = new NotificationsService(repository);
    const createdAt = new Date('2030-01-01T10:00:00.000Z');
    const record = {
      id: 'notification-1',
      institutionId: 'institution-1',
      recipientMembershipId: 'membership-1',
      actorUserId: null,
      type: AppNotificationType.TripRequestRejected,
      title: 'Solicitud rechazada',
      body: 'El conductor rechazo la solicitud.',
      actionUrl: '/viajes?passengerView=requests',
      readAt: createdAt,
      createdAt,
    };

    repository.listNotificationsByMembershipId.mockResolvedValue([record]);
    repository.countUnreadByMembershipId.mockResolvedValue(2);
    repository.markNotificationAsRead.mockResolvedValue(record);
    repository.markAllNotificationsAsRead.mockResolvedValue(3);

    await expect(service.listForMembership('membership-1')).resolves.toEqual([record]);
    await expect(service.countUnreadForMembership('membership-1')).resolves.toBe(2);
    await expect(
      service.markAsRead('membership-1', 'notification-1'),
    ).resolves.toEqual(record);
    await expect(service.markAllAsRead('membership-1')).resolves.toBe(3);
  });
});
