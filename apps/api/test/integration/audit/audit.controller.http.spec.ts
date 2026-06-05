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
import { ListAuditEventsUseCase } from '../../../src/modules/audit/application/use-cases/list-audit-events.use-case';
import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditController } from '../../../src/modules/audit/presentation/controllers/audit.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('AuditController HTTP', () => {
  let app: INestApplication;
  const listAuditEventsUseCase = { execute: jest.fn() };

  const authenticatedAdmin: CurrentUserContext = {
    id: 'admin-1',
    email: 'admin@uta.edu.ec',
    fullName: 'Admin UTA',
    globalRole: GlobalUserRole.SuperAdmin,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-admin',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        role: InstitutionMembershipRole.InstitutionAdmin,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'ADMIN-001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
  };

  const authenticatedHttpContext = createAuthenticatedHttpContext(authenticatedAdmin);

  beforeAll(async () => {
    const testApp = await createHttpTestApp({
      controllers: [AuditController],
      providers: [
        { provide: ListAuditEventsUseCase, useValue: listAuditEventsUseCase },
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

  it('lists audit events using transformed query filters', async () => {
    listAuditEventsUseCase.execute.mockResolvedValue({
      items: [],
    });

    await request(app.getHttpServer())
      .get('/api/audit/events')
      .set('Authorization', 'Bearer test-token')
      .query({
        institutionId: 'institution-1',
        actorUserId: 'user-2',
        action: AuditAction.TripCreated,
        entityType: AuditEntityType.Trip,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-05T00:00:00.000Z',
        limit: '50',
      })
      .expect(200);

    expect(listAuditEventsUseCase.execute).toHaveBeenCalledWith({
      currentUser: expect.objectContaining({ id: 'admin-1' }),
      institutionId: 'institution-1',
      actorUserId: 'user-2',
      action: AuditAction.TripCreated,
      entityType: AuditEntityType.Trip,
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-05T00:00:00.000Z',
      limit: 50,
    });
  });

  it('rejects invalid audit query filters before reaching the use case', async () => {
    await request(app.getHttpServer())
      .get('/api/audit/events')
      .set('Authorization', 'Bearer test-token')
      .query({
        action: 'INVALID_ACTION',
      })
      .expect(400);

    expect(listAuditEventsUseCase.execute).not.toHaveBeenCalled();
  });
});
