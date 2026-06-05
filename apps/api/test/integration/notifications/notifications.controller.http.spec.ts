import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import { NotificationsService } from '../../../src/modules/notifications/application/services/notifications.service';
import { NotificationsController } from '../../../src/modules/notifications/presentation/controllers/notifications.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('NotificationsController HTTP', () => {
  let app: INestApplication;
  const notificationsService = {
    listForMembership: jest.fn(),
    countUnreadForMembership: jest.fn(),
    markAllAsRead: jest.fn(),
    markAsRead: jest.fn(),
  };

  const authenticatedUser: CurrentUserContext = {
    id: 'user-1',
    email: 'student@uta.edu.ec',
    fullName: 'Usuario Uno',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-secondary',
        institutionId: 'institution-2',
        institutionName: 'Otra',
        role: InstitutionMembershipRole.Student,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'SEC-001',
        isDefault: false,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
      {
        id: 'membership-default',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        role: InstitutionMembershipRole.Student,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'UTA001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
  };

  const authenticatedHttpContext = createAuthenticatedHttpContext(authenticatedUser);

  beforeAll(async () => {
    const testApp = await createHttpTestApp({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
        ...authenticatedHttpContext.guardProviders,
      ],
    });

    app = testApp.app;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authenticatedHttpContext.applyAuthenticatedUser();
  });

  it('lists notifications for the default active membership', async () => {
    notificationsService.listForMembership.mockResolvedValue([{ id: 'notification-1' }]);

    const response = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body).toEqual({
      items: [{ id: 'notification-1' }],
    });
    expect(notificationsService.listForMembership).toHaveBeenCalledWith(
      'membership-default',
    );
  });

  it('returns the unread count for the default active membership', async () => {
    notificationsService.countUnreadForMembership.mockResolvedValue(3);

    const response = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body).toEqual({ count: 3 });
    expect(notificationsService.countUnreadForMembership).toHaveBeenCalledWith(
      'membership-default',
    );
  });

  it('marks all notifications as read', async () => {
    notificationsService.markAllAsRead.mockResolvedValue(5);

    const response = await request(app.getHttpServer())
      .patch('/api/notifications/read-all')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body).toEqual({ updatedCount: 5 });
    expect(notificationsService.markAllAsRead).toHaveBeenCalledWith('membership-default');
  });

  it('returns 404 when a notification does not exist for mark-as-read', async () => {
    notificationsService.markAsRead.mockResolvedValue(null);

    await request(app.getHttpServer())
      .patch('/api/notifications/notification-404/read')
      .set('Authorization', 'Bearer test-token')
      .expect(404);

    expect(notificationsService.markAsRead).toHaveBeenCalledWith(
      'membership-default',
      'notification-404',
    );
  });
});
