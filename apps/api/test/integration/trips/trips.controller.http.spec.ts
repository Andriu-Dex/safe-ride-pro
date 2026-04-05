import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  TripAvailabilityFilter,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import { CancelTripUseCase } from '../../../src/modules/trips/application/use-cases/cancel-trip.use-case';
import { CompleteTripUseCase } from '../../../src/modules/trips/application/use-cases/complete-trip.use-case';
import { CreateTripUseCase } from '../../../src/modules/trips/application/use-cases/create-trip.use-case';
import { GetTripByIdUseCase } from '../../../src/modules/trips/application/use-cases/get-trip-by-id.use-case';
import { ListTripsUseCase } from '../../../src/modules/trips/application/use-cases/list-trips.use-case';
import { PublishTripUseCase } from '../../../src/modules/trips/application/use-cases/publish-trip.use-case';
import { StartTripUseCase } from '../../../src/modules/trips/application/use-cases/start-trip.use-case';
import { TripsController } from '../../../src/modules/trips/presentation/controllers/trips.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('TripsController HTTP', () => {
  let app: INestApplication;
  const createTripUseCase = {
    execute: jest.fn(),
  };
  const listTripsUseCase = {
    execute: jest.fn(),
  };
  const getTripByIdUseCase = {
    execute: jest.fn(),
  };
  const publishTripUseCase = {
    execute: jest.fn(),
  };
  const startTripUseCase = {
    execute: jest.fn(),
  };
  const completeTripUseCase = {
    execute: jest.fn(),
  };
  const cancelTripUseCase = {
    execute: jest.fn(),
  };

  const authenticatedUser: CurrentUserContext = {
    id: 'user-1',
    email: 'driver@uta.edu.ec',
    fullName: 'Conductor Uno',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-1',
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
  const authenticatedHttpContext = createAuthenticatedHttpContext(authenticatedUser);

  beforeAll(async () => {
    const testApp = await createHttpTestApp({
      controllers: [TripsController],
      providers: [
        {
          provide: CreateTripUseCase,
          useValue: createTripUseCase,
        },
        {
          provide: ListTripsUseCase,
          useValue: listTripsUseCase,
        },
        {
          provide: GetTripByIdUseCase,
          useValue: getTripByIdUseCase,
        },
        {
          provide: PublishTripUseCase,
          useValue: publishTripUseCase,
        },
        {
          provide: StartTripUseCase,
          useValue: startTripUseCase,
        },
        {
          provide: CompleteTripUseCase,
          useValue: completeTripUseCase,
        },
        {
          provide: CancelTripUseCase,
          useValue: cancelTripUseCase,
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

  it('creates a trip through HTTP using the authenticated user context', async () => {
    createTripUseCase.execute.mockResolvedValue({
      message: 'Viaje creado en borrador correctamente.',
      trip: {
        id: 'trip-1',
        status: TripStatus.Draft,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/trips')
      .set('Authorization', 'Bearer test-token')
      .send({
        vehicleId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
        routeMode: TripRouteMode.DirectRoute,
        originLabel: 'Campus Huachi',
        destinationLabel: 'Centro',
        originLatitude: -1.25,
        originLongitude: -78.62,
        destinationLatitude: -1.24,
        destinationLongitude: -78.61,
        departureAt: '2030-01-01T10:00:00.000Z',
        estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
        seatCount: 3,
        basePriceReference: 2.5,
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Viaje creado en borrador correctamente.',
      trip: {
        id: 'trip-1',
        status: TripStatus.Draft,
      },
    });
    expect(createTripUseCase.execute).toHaveBeenCalledWith({
      userId: 'user-1',
      vehicleId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Campus Huachi',
      destinationLabel: 'Centro',
      originLatitude: -1.25,
      originLongitude: -78.62,
      destinationLatitude: -1.24,
      destinationLongitude: -78.61,
      departureAt: '2030-01-01T10:00:00.000Z',
      estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
      seatCount: 3,
      basePriceReference: 2.5,
      detourSurchargeReference: undefined,
      notes: undefined,
    });
  });

  it('rejects invalid trip payloads before reaching the use case', async () => {
    await request(app.getHttpServer())
      .post('/api/trips')
      .set('Authorization', 'Bearer test-token')
      .send({
        vehicleId: 'not-a-uuid',
        routeMode: 'UNKNOWN_MODE',
        originLabel: '',
      })
      .expect(400);

    expect(createTripUseCase.execute).not.toHaveBeenCalled();
  });

  it('rejects publish requests with invalid UUID route params', async () => {
    await request(app.getHttpServer())
      .patch('/api/trips/not-a-uuid/publish')
      .set('Authorization', 'Bearer test-token')
      .send({})
      .expect(400);

    expect(publishTripUseCase.execute).not.toHaveBeenCalled();
  });

  it('lists trips with query filters transformed by the DTO', async () => {
    listTripsUseCase.execute.mockResolvedValue({
      items: [],
    });

    await request(app.getHttpServer())
      .get('/api/trips')
      .set('Authorization', 'Bearer test-token')
      .query({
        origin: 'Huachi',
        destination: 'Centro',
        timeFrom: '07:00',
        timeTo: '09:30',
        availability: TripAvailabilityFilter.Available,
        vehicleType: VehicleType.Car,
        mine: 'true',
      })
      .expect(200);

    expect(listTripsUseCase.execute).toHaveBeenCalledWith({
      userId: 'user-1',
      mine: true,
      origin: 'Huachi',
      destination: 'Centro',
      dateFrom: undefined,
      dateTo: undefined,
      timeFrom: '07:00',
      timeTo: '09:30',
      routeMode: undefined,
      vehicleType: VehicleType.Car,
      availability: TripAvailabilityFilter.Available,
    });
  });
});
