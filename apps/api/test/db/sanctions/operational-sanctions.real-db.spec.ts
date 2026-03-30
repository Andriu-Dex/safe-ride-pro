import type { INestApplication } from '@nestjs/common';
import {
  AdministrativeRiskState,
  LuggagePolicy,
  OperationalSanctionType,
  TripRouteMode,
  TripStatus,
  VehicleType,
  VisibleReputationState,
} from '@saferidepro/shared-types';
import request from 'supertest';

import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';
import { createRealDbTestApp } from '../helpers/create-real-db-test-app';
import { registerVerifyAndLoginUser } from '../helpers/auth-flow.helpers';

describe('Operational sanctions real DB integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const testApp = await createRealDbTestApp();

    app = testApp.app;
    prisma = testApp.prisma;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('applies a passenger restriction after three recent no-shows and blocks new trip requests', async () => {
    const uniqueSuffix = Date.now().toString();
    const driverEmail = `driver.sanctions.${uniqueSuffix}@uta.edu.ec`;
    const passengerEmail = `passenger.sanctions.${uniqueSuffix}@uta.edu.ec`;

    const driverSession = await registerVerifyAndLoginUser(app, {
      email: driverEmail,
      password: 'DriverPass123!',
      fullName: 'Conductor Sanciones',
      documentNumber: `31${uniqueSuffix.slice(-8)}`,
      studentCode: `DRV-SAN-${uniqueSuffix.slice(-4)}`,
    });
    const passengerSession = await registerVerifyAndLoginUser(app, {
      email: passengerEmail,
      password: 'PassengerPass123!',
      fullName: 'Pasajero Sanciones',
      documentNumber: `32${uniqueSuffix.slice(-8)}`,
      studentCode: `PAS-SAN-${uniqueSuffix.slice(-4)}`,
    });

    const driverMembershipId = driverSession.login.user.memberships[0].id as string;
    const passengerMembershipId = passengerSession.login.user.memberships[0].id as string;
    const institutionId = passengerSession.login.user.memberships[0].institutionId as string;
    const passengerToken = passengerSession.login.accessToken as string;

    const vehicle = await prisma.vehicle.create({
      data: {
        membershipId: driverMembershipId,
        vehicleType: 'CAR',
        year: 2024,
        color: 'Gris',
        plate: `SAN${uniqueSuffix.slice(-5)}`,
        seatCount: 4,
        luggagePolicy: LuggagePolicy.SmallOnly,
        isActive: true,
      },
    });

    const recentReviewDate = new Date();
    recentReviewDate.setDate(recentReviewDate.getDate() - 2);

    for (let index = 0; index < 3; index += 1) {
      const departureAt = new Date(recentReviewDate);
      departureAt.setHours(8 + index, 0, 0, 0);
      const estimatedArrivalAt = new Date(departureAt);
      estimatedArrivalAt.setMinutes(estimatedArrivalAt.getMinutes() + 25);

      const trip = await prisma.trip.create({
        data: {
          institutionId,
          driverMembershipId,
          vehicleId: vehicle.id,
          status: TripStatus.Completed,
          routeMode: TripRouteMode.DirectRoute,
          originLabel: `Campus ${index + 1}`,
          destinationLabel: `Centro ${index + 1}`,
          originLatitude: -1.26 + index * 0.001,
          originLongitude: -78.62 + index * 0.001,
          destinationLatitude: -1.24 + index * 0.001,
          destinationLongitude: -78.61 + index * 0.001,
          departureAt,
          estimatedArrivalAt,
          seatCount: 2,
          availableSeats: 1,
          vehicleTypeSnapshot: VehicleType.Car,
          luggagePolicySnapshot: LuggagePolicy.SmallOnly,
          basePriceReference: 2.5,
        },
      });

      await prisma.tripRequest.create({
        data: {
          tripId: trip.id,
          passengerMembershipId,
          status: 'NO_SHOW',
          reviewNote: 'El pasajero no se presento.',
          createdAt: departureAt,
          reviewedAt: recentReviewDate,
        },
      });
    }

    const futureDepartureAt = new Date();
    futureDepartureAt.setDate(futureDepartureAt.getDate() + 1);
    futureDepartureAt.setHours(9, 30, 0, 0);
    const futureArrivalAt = new Date(futureDepartureAt);
    futureArrivalAt.setMinutes(futureArrivalAt.getMinutes() + 30);

    const futureTrip = await prisma.trip.create({
      data: {
        institutionId,
        driverMembershipId,
        vehicleId: vehicle.id,
        status: TripStatus.Published,
        routeMode: TripRouteMode.DirectRoute,
        originLabel: 'Campus Huachi',
        destinationLabel: 'Terminal',
        originLatitude: -1.2624,
        originLongitude: -78.6282,
        destinationLatitude: -1.2417,
        destinationLongitude: -78.6194,
        departureAt: futureDepartureAt,
        estimatedArrivalAt: futureArrivalAt,
        seatCount: 3,
        availableSeats: 2,
        vehicleTypeSnapshot: VehicleType.Car,
        luggagePolicySnapshot: LuggagePolicy.SmallOnly,
        basePriceReference: 2.75,
      },
    });

    const trustSummaryResponse = await request(app.getHttpServer())
      .get('/api/users/me/trust-summary')
      .set('Authorization', `Bearer ${passengerToken}`)
      .expect(200);

    expect(trustSummaryResponse.body.passengerNoShows).toBe(3);
    expect(trustSummaryResponse.body.visibleReputationState).toBe(
      VisibleReputationState.Restricted,
    );
    expect(trustSummaryResponse.body.administrativeRiskState).toBe(
      AdministrativeRiskState.Restricted,
    );
    expect(trustSummaryResponse.body.recentBlockingSanctionCount).toBeGreaterThanOrEqual(1);
    expect(trustSummaryResponse.body.activeSanctions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: OperationalSanctionType.LimitedPassenger,
        }),
      ]),
    );

    const storedSanctions = await prisma.operationalSanction.findMany({
      where: {
        membershipId: passengerMembershipId,
        status: 'ACTIVE',
      },
    });

    expect(storedSanctions.some((sanction) => sanction.type === 'LIMITED_PASSENGER')).toBe(true);

    const createRequestResponse = await request(app.getHttpServer())
      .post('/api/trip-requests')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({
        tripId: futureTrip.id,
        requestMessage: 'Intento de prueba bloqueado por sancion.',
      })
      .expect(403);

    expect(createRequestResponse.body.message).toContain(
      'restriccion temporal para operar como pasajero',
    );
  });
});
