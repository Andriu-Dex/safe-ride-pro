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
import { LiftOperationalSanctionUseCase } from '../../../src/modules/sanctions/application/use-cases/lift-operational-sanction.use-case';
import { ListMySanctionAppealsUseCase } from '../../../src/modules/sanctions/application/use-cases/list-my-sanction-appeals.use-case';
import { ListReviewableActiveSanctionsUseCase } from '../../../src/modules/sanctions/application/use-cases/list-reviewable-active-sanctions.use-case';
import { ListReviewableSanctionAppealsUseCase } from '../../../src/modules/sanctions/application/use-cases/list-reviewable-sanction-appeals.use-case';
import { ReviewSanctionAppealUseCase } from '../../../src/modules/sanctions/application/use-cases/review-sanction-appeal.use-case';
import { SubmitSanctionAppealUseCase } from '../../../src/modules/sanctions/application/use-cases/submit-sanction-appeal.use-case';
import { SanctionsController } from '../../../src/modules/sanctions/presentation/controllers/sanctions.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('SanctionsController HTTP', () => {
  let app: INestApplication;
  const listMySanctionAppealsUseCase = {
    execute: jest.fn(),
  };
  const submitSanctionAppealUseCase = {
    execute: jest.fn(),
  };
  const listReviewableSanctionAppealsUseCase = {
    execute: jest.fn(),
  };
  const reviewSanctionAppealUseCase = {
    execute: jest.fn(),
  };
  const listReviewableActiveSanctionsUseCase = {
    execute: jest.fn(),
  };
  const liftOperationalSanctionUseCase = {
    execute: jest.fn(),
  };

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
      controllers: [SanctionsController],
      providers: [
        {
          provide: ListMySanctionAppealsUseCase,
          useValue: listMySanctionAppealsUseCase,
        },
        {
          provide: SubmitSanctionAppealUseCase,
          useValue: submitSanctionAppealUseCase,
        },
        {
          provide: ListReviewableSanctionAppealsUseCase,
          useValue: listReviewableSanctionAppealsUseCase,
        },
        {
          provide: ReviewSanctionAppealUseCase,
          useValue: reviewSanctionAppealUseCase,
        },
        {
          provide: ListReviewableActiveSanctionsUseCase,
          useValue: listReviewableActiveSanctionsUseCase,
        },
        {
          provide: LiftOperationalSanctionUseCase,
          useValue: liftOperationalSanctionUseCase,
        },
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

  it('lists reviewable active sanctions with user filters for the admin panel', async () => {
    listReviewableActiveSanctionsUseCase.execute.mockResolvedValue({
      items: [],
    });

    await request(app.getHttpServer())
      .get('/api/sanctions/inbox')
      .set('Authorization', 'Bearer test-token')
      .query({
        institutionId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
        userId: '7cd59d21-01aa-4764-b9f5-fa05a13997e5',
        limit: '100',
      })
      .expect(200);

    expect(listReviewableActiveSanctionsUseCase.execute).toHaveBeenCalledWith({
      currentUser: expect.objectContaining({
        id: 'admin-1',
      }),
      institutionId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
      userId: '7cd59d21-01aa-4764-b9f5-fa05a13997e5',
      limit: 100,
    });
  });

  it('lifts an operational sanction through HTTP using the authenticated admin', async () => {
    liftOperationalSanctionUseCase.execute.mockResolvedValue({
      message: 'Sancion levantada manualmente correctamente.',
      sanction: {
        id: 'sanction-1',
      },
    });

    const response = await request(app.getHttpServer())
      .patch('/api/sanctions/8fe59d21-01aa-4764-b9f5-fa05a13997e4/lift')
      .set('Authorization', 'Bearer test-token')
      .send({
        reviewNote: 'Levantado desde panel de usuarios',
      })
      .expect(200);

    expect(response.body).toEqual({
      message: 'Sancion levantada manualmente correctamente.',
      sanction: {
        id: 'sanction-1',
      },
    });
    expect(liftOperationalSanctionUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'admin-1',
      }),
      {
        sanctionId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
        reviewNote: 'Levantado desde panel de usuarios',
      },
    );
  });

  it('rejects invalid lift payloads before reaching the use case', async () => {
    await request(app.getHttpServer())
      .patch('/api/sanctions/8fe59d21-01aa-4764-b9f5-fa05a13997e4/lift')
      .set('Authorization', 'Bearer test-token')
      .send({
        reviewNote: 123,
      })
      .expect(400);

    expect(liftOperationalSanctionUseCase.execute).not.toHaveBeenCalled();
  });
});
