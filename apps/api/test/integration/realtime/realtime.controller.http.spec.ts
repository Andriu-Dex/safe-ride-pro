import { INestApplication } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import request from 'supertest';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import { RealtimeEventsService } from '../../../src/modules/realtime/application/services/realtime-events.service';
import { RealtimeController } from '../../../src/modules/realtime/presentation/controllers/realtime.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('RealtimeController HTTP', () => {
  let app: INestApplication;
  const realtimeEventsService = {
    openStream: jest.fn(
      (
        _currentUser: CurrentUserContext,
        _request: IncomingMessage,
        response: ServerResponse<IncomingMessage>,
      ) => {
        response.statusCode = 200;
        response.setHeader('content-type', 'text/event-stream');
        response.end('data: connected\n\n');
      },
    ),
  };

  const authenticatedUser: CurrentUserContext = {
    id: 'user-1',
    email: 'student@uta.edu.ec',
    fullName: 'Usuario Uno',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-1',
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
      controllers: [RealtimeController],
      providers: [
        { provide: RealtimeEventsService, useValue: realtimeEventsService },
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

  it('opens the realtime SSE stream for the authenticated user', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/realtime/stream')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.text).toContain('data: connected');
    expect(response.header['content-type']).toContain('text/event-stream');
    expect(realtimeEventsService.openStream).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.anything(),
      expect.anything(),
    );
  });
});
