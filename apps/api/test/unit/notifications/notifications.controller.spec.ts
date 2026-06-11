import { NotFoundException } from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';

import { NotificationsService } from '../../../src/modules/notifications/application/services/notifications.service';
import { NotificationsController } from '../../../src/modules/notifications/presentation/controllers/notifications.controller';
import { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let serviceMock: jest.Mocked<NotificationsService>;

  beforeEach(() => {
    serviceMock = {
      listForMembership: jest.fn(),
      countUnreadForMembership: jest.fn(),
      markAllAsRead: jest.fn(),
      markAsRead: jest.fn(),
    } as any;
    controller = new NotificationsController(serviceMock);
  });

  function buildUserWithMembership(): CurrentUserContext {
    return {
      id: 'user-1',
      memberships: [
        {
          id: 'membership-1',
          membershipStatus: MembershipStatus.Active,
          institutionIsActive: true,
          isDefault: true,
        } as any,
      ],
    } as any;
  }

  it('lists notifications for the default active membership', async () => {
    serviceMock.listForMembership.mockResolvedValue(['item1', 'item2'] as any);
    const result = await controller.listNotifications(buildUserWithMembership());

    expect(serviceMock.listForMembership).toHaveBeenCalledWith('membership-1');
    expect(result.items).toEqual(['item1', 'item2']);
  });

  it('gets unread count for the default active membership', async () => {
    serviceMock.countUnreadForMembership.mockResolvedValue(5);
    const result = await controller.getUnreadCount(buildUserWithMembership());

    expect(serviceMock.countUnreadForMembership).toHaveBeenCalledWith('membership-1');
    expect(result.count).toBe(5);
  });

  it('marks all as read for the default active membership', async () => {
    serviceMock.markAllAsRead.mockResolvedValue(3);
    const result = await controller.markAllAsRead(buildUserWithMembership());

    expect(serviceMock.markAllAsRead).toHaveBeenCalledWith('membership-1');
    expect(result.updatedCount).toBe(3);
  });

  it('marks a specific notification as read', async () => {
    serviceMock.markAsRead.mockResolvedValue({ id: 'notif-1', readAt: new Date() } as any);
    const result = await controller.markAsRead(buildUserWithMembership(), 'notif-1');

    expect(serviceMock.markAsRead).toHaveBeenCalledWith('membership-1', 'notif-1');
    expect(result.notification.id).toBe('notif-1');
  });

  it('throws NotFoundException if the specific notification does not exist (covers line 60)', async () => {
    serviceMock.markAsRead.mockResolvedValue(null);

    await expect(controller.markAsRead(buildUserWithMembership(), 'non-existent')).rejects.toThrow(
      new NotFoundException('La notificacion no existe.'),
    );
  });

  it('throws NotFoundException if the user has no active memberships (covers line 73)', async () => {
    const userWithoutMemberships: CurrentUserContext = {
      id: 'user-1',
      memberships: [],
    } as any;

    await expect(controller.listNotifications(userWithoutMemberships)).rejects.toThrow(
      new NotFoundException('No encontramos una membresia activa.'),
    );
  });
});
