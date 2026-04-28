import type { INestApplication } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import {
  DriverVerificationStatus,
  LuggagePolicy,
  ReportStatus as SharedReportStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';
import request from 'supertest';

import { AuditAction } from '../../../src/modules/audit/domain/audit.types';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';
import { createRealDbTestApp } from '../helpers/create-real-db-test-app';
import {
  loginSeedAdmin,
  registerVerifyAndLoginUser,
} from '../helpers/auth-flow.helpers';

describe('Critical MVP flow real DB integration', () => {
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

  it('completes the driver, trip, trust and report review flow against PostgreSQL', async () => {
    const uniqueSuffix = Date.now().toString();
    const departureAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const estimatedArrivalAt = new Date(Date.now() + 40 * 60_000).toISOString();
    const driverPassword = 'DriverPass123!';
    const passengerPassword = 'PassengerPass123!';
    const waitingPassengerPassword = 'WaitingPassenger123!';
    const driverEmail = `driver.${uniqueSuffix}@uta.edu.ec`;
    const passengerEmail = `passenger.${uniqueSuffix}@uta.edu.ec`;
    const waitingPassengerEmail = `waiting.${uniqueSuffix}@uta.edu.ec`;

    const driverSession = await registerVerifyAndLoginUser(app, {
      email: driverEmail,
      password: driverPassword,
      fullName: 'Conductor DB Real',
      documentNumber: `101001${uniqueSuffix}`,
      studentCode: `DRV-${uniqueSuffix.slice(-6)}`,
    });
    const passengerSession = await registerVerifyAndLoginUser(app, {
      email: passengerEmail,
      password: passengerPassword,
      fullName: 'Pasajero DB Real',
      documentNumber: `202002${uniqueSuffix}`,
      studentCode: `PAS-${uniqueSuffix.slice(-6)}`,
    });
    const waitingPassengerSession = await registerVerifyAndLoginUser(app, {
      email: waitingPassengerEmail,
      password: waitingPassengerPassword,
      fullName: 'Pasajero Pendiente DB Real',
      documentNumber: `303003${uniqueSuffix}`,
      studentCode: `PEN-${uniqueSuffix.slice(-6)}`,
    });
    const adminSession = await loginSeedAdmin(app);

    const driverToken = driverSession.login.accessToken as string;
    const passengerToken = passengerSession.login.accessToken as string;
    const waitingPassengerToken = waitingPassengerSession.login.accessToken as string;
    const adminToken = adminSession.body.accessToken as string;
    const driverMembershipId = driverSession.login.user.memberships[0].id as string;
    const passengerMembershipId = passengerSession.login.user.memberships[0].id as string;

    const licenseTypesResponse = await request(app.getHttpServer())
      .get('/api/vehicles/catalogs/license-types')
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);
    const licenseTypeId = licenseTypesResponse.body[0].id as string;

    const brandsResponse = await request(app.getHttpServer())
      .get('/api/vehicles/catalogs/brands')
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);
    const brandId = brandsResponse.body.find((brand: { name: string }) => brand.name === 'Toyota')?.id
      ?? brandsResponse.body[0].id;

    const modelsResponse = await request(app.getHttpServer())
      .get('/api/vehicles/catalogs/models')
      .query({
        brandId,
        vehicleType: VehicleType.Car,
      })
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);
    const modelId = modelsResponse.body.find((model: { name: string }) => model.name === 'Corolla')?.id
      ?? modelsResponse.body[0].id;

    const driverApplicationResponse = await request(app.getHttpServer())
      .post('/api/drivers/application')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        licenseTypeId,
        licenseExpiresAt: '2035-01-01T00:00:00.000Z',
        identityDocumentFileKey: 'documents/driver-id.pdf',
        licenseDocumentFileKey: 'documents/driver-license.pdf',
      })
      .expect(201);

    expect(driverApplicationResponse.body.driverProfile.membershipId).toBe(driverMembershipId);
    expect(driverApplicationResponse.body.driverProfile.driverVerificationStatus).toBe(
      DriverVerificationStatus.PendingVerification,
    );

    const approvalResponse = await request(app.getHttpServer())
      .patch(`/api/drivers/applications/${driverMembershipId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: DriverVerificationStatus.Approved,
        reviewNotes: 'Documentos verificados correctamente.',
      })
      .expect(200);

    expect(approvalResponse.body.driverProfile.driverVerificationStatus).toBe(
      DriverVerificationStatus.Approved,
    );

    const vehicleResponse = await request(app.getHttpServer())
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        vehicleType: VehicleType.Car,
        brandId,
        modelId,
        year: 2024,
        color: 'Azul',
        plate: `TST${uniqueSuffix.slice(-6)}`,
        seatCount: 3,
        luggagePolicy: LuggagePolicy.SmallOnly,
        registrationDocumentFileKey: 'documents/vehicle-registration.pdf',
      })
      .expect(201);
    const vehicleId = vehicleResponse.body.vehicle.id as string;

    const createTripResponse = await request(app.getHttpServer())
      .post('/api/trips')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        vehicleId,
        routeMode: TripRouteMode.DirectRoute,
        originLabel: 'Campus Huachi',
        destinationLabel: 'Terminal Ambato',
        originLatitude: -1.2624,
        originLongitude: -78.6282,
        destinationLatitude: -1.2417,
        destinationLongitude: -78.6194,
        departureAt,
        estimatedArrivalAt,
        seatCount: 2,
        basePriceReference: 2.5,
        notes: 'Salida puntual desde el campus.',
      })
      .expect(201);
    const tripId = createTripResponse.body.trip.id as string;

    expect(createTripResponse.body.trip.status).toBe(TripStatus.Draft);

    await request(app.getHttpServer())
      .patch(`/api/trips/${tripId}/publish`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({})
      .expect(200);

    const tripRequestResponse = await request(app.getHttpServer())
      .post('/api/trip-requests')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({
        tripId,
        requestMessage: 'Puedo esperar en la entrada principal.',
      })
      .expect(201);
    const tripRequestId = tripRequestResponse.body.tripRequest.id as string;

    const pendingTripRequestResponse = await request(app.getHttpServer())
      .post('/api/trip-requests')
      .set('Authorization', `Bearer ${waitingPassengerToken}`)
      .send({
        tripId,
        requestMessage: 'Quedo pendiente para la misma ruta.',
      })
      .expect(201);
    const pendingTripRequestId = pendingTripRequestResponse.body.tripRequest.id as string;

    const acceptRequestResponse = await request(app.getHttpServer())
      .patch(`/api/trip-requests/${tripRequestId}/accept`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        reviewNote: 'Te confirmo el cupo.',
      })
      .expect(200);

    expect(acceptRequestResponse.body.tripRequest.status).toBe('ACCEPTED');

    await request(app.getHttpServer())
      .patch(`/api/trips/${tripId}/start`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/trip-requests/${tripRequestId}/boarded`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/trip-requests/${tripRequestId}/dropped-off`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/trips/${tripId}/complete`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({})
      .expect(200);

    const ratingResponse = await request(app.getHttpServer())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({
        tripId,
        targetMembershipId: driverMembershipId,
        score: 5,
        comment: 'Viaje seguro y puntual.',
      })
      .expect(201);

    expect(ratingResponse.body.rating.score).toBe(5);

    const reportResponse = await request(app.getHttpServer())
      .post('/api/reports')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({
        tripId,
        reportedMembershipId: driverMembershipId,
        reason: 'Conduccion riesgosa',
        description: 'El conductor uso el telefono durante el trayecto.',
        evidenceFileKey: 'reports/evidence-001.png',
      })
      .expect(201);
    const reportId = reportResponse.body.report.id as string;

    const reviewableReportsResponse = await request(app.getHttpServer())
      .get('/api/reports/inbox')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      reviewableReportsResponse.body.items.some((report: { id: string }) => report.id === reportId),
    ).toBe(true);

    await request(app.getHttpServer())
      .patch(`/api/reports/${reportId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: SharedReportStatus.UnderReview,
        reviewNote: 'Se solicita ampliacion de informacion.',
      })
      .expect(200);

    const passengerTrustSummaryResponse = await request(app.getHttpServer())
      .get('/api/users/me/trust-summary')
      .set('Authorization', `Bearer ${passengerToken}`)
      .expect(200);

    const driverTrustSummaryResponse = await request(app.getHttpServer())
      .get('/api/users/me/trust-summary')
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);

    const storedTrip = await prisma.trip.findUnique({
      where: { id: tripId },
    });
    const storedRequest = await prisma.tripRequest.findUnique({
      where: { id: tripRequestId },
    });
    const storedPendingRequest = await prisma.tripRequest.findUnique({
      where: { id: pendingTripRequestId },
    });
    const storedRating = await prisma.rating.findFirst({
      where: {
        tripId,
        authorMembershipId: passengerMembershipId,
        targetMembershipId: driverMembershipId,
      },
    });
    const storedReport = await prisma.report.findUnique({
      where: { id: reportId },
    });
    const driverMembership = await prisma.userInstitutionMembership.findUnique({
      where: { id: driverMembershipId },
    });
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        action: {
          in: [
            AuditAction.DriverApplicationSubmitted,
            AuditAction.DriverApplicationApproved,
            AuditAction.TripCreated,
            AuditAction.TripPublished,
            AuditAction.TripStarted,
            AuditAction.TripCompleted,
            AuditAction.ReportCreated,
            AuditAction.ReportReviewed,
          ],
        },
      },
    });

    expect(driverMembership?.driverVerificationStatus).toBe('APPROVED');
    expect(storedTrip?.status).toBe(TripStatus.Completed);
    expect(storedTrip?.availableSeats).toBe(1);
    expect(storedRequest?.status).toBe('ACCEPTED');
    expect(storedRequest?.executionStatus).toBe('DROPPED_OFF');
    expect(storedPendingRequest?.status).toBe('REJECTED');
    expect(storedPendingRequest?.reviewNote).toBe(
      'Solicitud cerrada automaticamente porque el viaje ya inicio.',
    );
    expect(storedRating?.score).toBe(5);
    expect(storedReport?.status).toBe(ReportStatus.UNDER_REVIEW);
    expect(passengerTrustSummaryResponse.body.completedTripsAsPassenger).toBe(1);
    expect(passengerTrustSummaryResponse.body.totalRatingsReceived).toBe(0);
    expect(passengerTrustSummaryResponse.body.latePassengerTripRequestCancellations).toBe(0);
    expect(passengerTrustSummaryResponse.body.passengerNoShows).toBe(0);
    expect(driverTrustSummaryResponse.body.completedTripsAsDriver).toBe(1);
    expect(driverTrustSummaryResponse.body.totalRatingsReceived).toBe(1);
    expect(driverTrustSummaryResponse.body.averageRatingReceived).toBe(5);
    expect(driverTrustSummaryResponse.body.resolvedReportsReceived).toBe(0);
    expect(auditEvents.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        AuditAction.DriverApplicationSubmitted,
        AuditAction.DriverApplicationApproved,
        AuditAction.TripCreated,
        AuditAction.TripPublished,
        AuditAction.TripStarted,
        AuditAction.TripCompleted,
        AuditAction.ReportCreated,
        AuditAction.ReportReviewed,
      ]),
    );
  });
});
