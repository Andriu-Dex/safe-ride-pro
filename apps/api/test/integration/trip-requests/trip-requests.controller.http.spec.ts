import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  TripRequestStatus,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import { AcceptTripRequestUseCase } from '../../../src/modules/trip-requests/application/use-cases/accept-trip-request.use-case';
import { CancelTripRequestUseCase } from '../../../src/modules/trip-requests/application/use-cases/cancel-trip-request.use-case';
import { CreateTripRequestUseCase } from '../../../src/modules/trip-requests/application/use-cases/create-trip-request.use-case';
import { ListDriverTripRequestsUseCase } from '../../../src/modules/trip-requests/application/use-cases/list-driver-trip-requests.use-case';
import { ListMyTripRequestsUseCase } from '../../../src/modules/trip-requests/application/use-cases/list-my-trip-requests.use-case';
import { MarkTripRequestBoardedUseCase } from '../../../src/modules/trip-requests/application/use-cases/mark-trip-request-boarded.use-case';
import { MarkTripRequestDroppedOffUseCase } from '../../../src/modules/trip-requests/application/use-cases/mark-trip-request-dropped-off.use-case';
import { MarkTripRequestNoShowUseCase } from '../../../src/modules/trip-requests/application/use-cases/mark-trip-request-no-show.use-case';
import { RejectTripRequestUseCase } from '../../../src/modules/trip-requests/application/use-cases/reject-trip-request.use-case';
import { TripRequestsController } from '../../../src/modules/trip-requests/presentation/controllers/trip-requests.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('TripRequestsController HTTP', () => {
  let app: INestApplication;
  const createTripRequestUseCase = {
    execute: jest.fn(),
  };
  const listMyTripRequestsUseCase = {
    execute: jest.fn(),
  };
  const listDriverTripRequestsUseCase = {
    execute: jest.fn(),
  };
  const acceptTripRequestUseCase = {
    execute: jest.fn(),
  };
  const rejectTripRequestUseCase = {
    execute: jest.fn(),
  };
  const cancelTripRequestUseCase = {
    execute: jest.fn(),
  };
  const markTripRequestBoardedUseCase = {
    execute: jest.fn(),
  };
  const markTripRequestDroppedOffUseCase = {
    execute: jest.fn(),
  };
  const markTripRequestNoShowUseCase = {
    execute: jest.fn(),
  };

  const passengerUser: CurrentUserContext = {
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

  const driverUser: CurrentUserContext = {
    id: 'user-driver',
    email: 'driver@uta.edu.ec',
    fullName: 'Conductor Uno',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-driver',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        role: InstitutionMembershipRole.Student,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'DRIVER-001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      },
    ],
  };

  const authenticatedHttpContext = createAuthenticatedHttpContext(passengerUser);

  beforeAll(async () => {
    const testApp = await createHttpTestApp({
      controllers: [TripRequestsController],
      providers: [
        {
          provide: CreateTripRequestUseCase,
          useValue: createTripRequestUseCase,
        },
        {
          provide: ListMyTripRequestsUseCase,
          useValue: listMyTripRequestsUseCase,
        },
        {
          provide: ListDriverTripRequestsUseCase,
          useValue: listDriverTripRequestsUseCase,
        },
        {
          provide: AcceptTripRequestUseCase,
          useValue: acceptTripRequestUseCase,
        },
        {
          provide: RejectTripRequestUseCase,
          useValue: rejectTripRequestUseCase,
        },
        {
          provide: CancelTripRequestUseCase,
          useValue: cancelTripRequestUseCase,
        },
        {
          provide: MarkTripRequestBoardedUseCase,
          useValue: markTripRequestBoardedUseCase,
        },
        {
          provide: MarkTripRequestDroppedOffUseCase,
          useValue: markTripRequestDroppedOffUseCase,
        },
        {
          provide: MarkTripRequestNoShowUseCase,
          useValue: markTripRequestNoShowUseCase,
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
    authenticatedHttpContext.applyAuthenticatedUser(passengerUser);
  });

  it('creates a trip request through HTTP using the authenticated passenger', async () => {
    createTripRequestUseCase.execute.mockResolvedValue({
      message: 'Solicitud enviada correctamente.',
      tripRequest: {
        id: 'request-1',
        status: TripRequestStatus.Pending,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/trip-requests')
      .set('Authorization', 'Bearer test-token')
      .send({
        tripId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
        requestedPickupLatitude: -1.25,
        requestedPickupLongitude: -78.62,
        requestMessage: 'Puedo estar listo en 5 minutos',
        acceptReservationCommitment: true,
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Solicitud enviada correctamente.',
      tripRequest: {
        id: 'request-1',
        status: TripRequestStatus.Pending,
      },
    });
    expect(createTripRequestUseCase.execute).toHaveBeenCalledWith({
      userId: 'user-passenger',
      tripId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
      requestedPickupLatitude: -1.25,
      requestedPickupLongitude: -78.62,
      requestedDropoffLatitude: undefined,
      requestedDropoffLongitude: undefined,
      requestMessage: 'Puedo estar listo en 5 minutos',
      paymentProvider: undefined,
      acceptReservationCommitment: true,
    });
  });

  it('rejects invalid trip request payloads before reaching the use case', async () => {
    await request(app.getHttpServer())
      .post('/api/trip-requests')
      .set('Authorization', 'Bearer test-token')
      .send({
        tripId: 'not-a-uuid',
        requestedPickupLatitude: 99,
      })
      .expect(400);

    expect(createTripRequestUseCase.execute).not.toHaveBeenCalled();
  });

  it('lists current passenger trip requests using the authenticated user id', async () => {
    listMyTripRequestsUseCase.execute.mockResolvedValue({
      items: [],
    });

    await request(app.getHttpServer())
      .get('/api/trip-requests/me')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(listMyTripRequestsUseCase.execute).toHaveBeenCalledWith('user-passenger');
  });

  it('accepts a trip request through HTTP using the authenticated driver', async () => {
    authenticatedHttpContext.applyAuthenticatedUser(driverUser);
    acceptTripRequestUseCase.execute.mockResolvedValue({
      message: 'Solicitud aceptada correctamente.',
      tripRequest: {
        id: 'request-1',
        status: TripRequestStatus.Accepted,
      },
    });

    await request(app.getHttpServer())
      .patch('/api/trip-requests/8fe59d21-01aa-4764-b9f5-fa05a13997e4/accept')
      .set('Authorization', 'Bearer test-token')
      .send({
        reviewNote: 'Te esperamos en la entrada principal',
      })
      .expect(200);

    expect(acceptTripRequestUseCase.execute).toHaveBeenCalledWith(
      'user-driver',
      '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
      'Te esperamos en la entrada principal',
    );
  });

  it('marks a trip request as boarded through HTTP using the authenticated driver', async () => {
    authenticatedHttpContext.applyAuthenticatedUser(driverUser);
    markTripRequestBoardedUseCase.execute.mockResolvedValue({
      message: 'Pasajero marcado como abordado.',
      tripRequest: {
        id: 'request-1',
        status: TripRequestStatus.Accepted,
      },
    });

    await request(app.getHttpServer())
      .patch('/api/trip-requests/8fe59d21-01aa-4764-b9f5-fa05a13997e4/boarded')
      .set('Authorization', 'Bearer test-token')
      .send({})
      .expect(200);

    expect(markTripRequestBoardedUseCase.execute).toHaveBeenCalledWith(
      'user-driver',
      '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
    );
  });

  it('marks a trip request as dropped off through HTTP using the authenticated driver', async () => {
    authenticatedHttpContext.applyAuthenticatedUser(driverUser);
    markTripRequestDroppedOffUseCase.execute.mockResolvedValue({
      message: 'Pasajero marcado como finalizado.',
      tripRequest: {
        id: 'request-1',
        status: TripRequestStatus.Accepted,
      },
    });

    await request(app.getHttpServer())
      .patch('/api/trip-requests/8fe59d21-01aa-4764-b9f5-fa05a13997e4/dropped-off')
      .set('Authorization', 'Bearer test-token')
      .send({})
      .expect(200);

    expect(markTripRequestDroppedOffUseCase.execute).toHaveBeenCalledWith(
      'user-driver',
      '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
    );
  });
});
