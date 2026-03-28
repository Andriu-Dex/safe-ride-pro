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
import { CreateRatingUseCase } from '../../../src/modules/ratings/application/use-cases/create-rating.use-case';
import { ListMyRatingsUseCase } from '../../../src/modules/ratings/application/use-cases/list-my-ratings.use-case';
import { RatingsController } from '../../../src/modules/ratings/presentation/controllers/ratings.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('RatingsController HTTP', () => {
  let app: INestApplication;
  const createRatingUseCase = {
    execute: jest.fn(),
  };
  const listMyRatingsUseCase = {
    execute: jest.fn(),
  };

  const authenticatedUser: CurrentUserContext = {
    id: 'user-passenger',
    email: 'passenger@uta.edu.ec',
    fullName: 'Pasajero Uno',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-passenger',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        role: InstitutionMembershipRole.Student,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'PASSENGER-001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
  };

  const authenticatedHttpContext = createAuthenticatedHttpContext(authenticatedUser);

  beforeAll(async () => {
    const testApp = await createHttpTestApp({
      controllers: [RatingsController],
      providers: [
        {
          provide: CreateRatingUseCase,
          useValue: createRatingUseCase,
        },
        {
          provide: ListMyRatingsUseCase,
          useValue: listMyRatingsUseCase,
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

  it('creates a rating through HTTP using the authenticated user id', async () => {
    createRatingUseCase.execute.mockResolvedValue({
      message: 'Calificacion registrada correctamente.',
      rating: {
        id: 'rating-1',
        score: 5,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/ratings')
      .set('Authorization', 'Bearer test-token')
      .send({
        tripId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
        targetMembershipId: '7cd59d21-01aa-4764-b9f5-fa05a13997e5',
        score: 5,
        comment: 'Excelente servicio',
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Calificacion registrada correctamente.',
      rating: {
        id: 'rating-1',
        score: 5,
      },
    });
    expect(createRatingUseCase.execute).toHaveBeenCalledWith({
      userId: 'user-passenger',
      tripId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
      targetMembershipId: '7cd59d21-01aa-4764-b9f5-fa05a13997e5',
      score: 5,
      comment: 'Excelente servicio',
    });
  });

  it('rejects invalid rating scores before reaching the use case', async () => {
    await request(app.getHttpServer())
      .post('/api/ratings')
      .set('Authorization', 'Bearer test-token')
      .send({
        tripId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
        targetMembershipId: '7cd59d21-01aa-4764-b9f5-fa05a13997e5',
        score: 6,
      })
      .expect(400);

    expect(createRatingUseCase.execute).not.toHaveBeenCalled();
  });

  it('lists ratings for the authenticated user', async () => {
    listMyRatingsUseCase.execute.mockResolvedValue({
      given: [],
      received: [],
    });

    await request(app.getHttpServer())
      .get('/api/ratings/me')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(listMyRatingsUseCase.execute).toHaveBeenCalledWith('user-passenger');
  });
});
