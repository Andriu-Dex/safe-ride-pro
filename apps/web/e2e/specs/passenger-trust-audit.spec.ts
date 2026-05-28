import { expect, test } from '@playwright/test';

import {
  approveDriverApplication,
  createPublishedTrip,
  createReport,
  createTripRequest,
  loginSeedAdmin,
  markTripRequestBoarded,
  markTripRequestDroppedOff,
  completeTrip,
  registerVehicle,
  registerVerifiedUser,
  startTrip,
  submitDriverApplication,
} from '../support/api';
import { signInThroughUi, waitForSectionHeading } from '../support/ui';

test('pasajero, conductor y admin completan solicitud, cierre, confianza y moderacion', async ({ browser }) => {
  test.setTimeout(180_000);

  const suffix = `${Date.now()}`;
  const adminSession = await loginSeedAdmin();
  const driver = await registerVerifiedUser('driver-flow');
  const passenger = await registerVerifiedUser('passenger-flow');

  await submitDriverApplication(driver.accessToken, suffix);
  await approveDriverApplication(adminSession.accessToken, driver.membershipId);
  const vehicleResponse = await registerVehicle(driver.accessToken, suffix);
  const tripResponse = await createPublishedTrip(driver.accessToken, vehicleResponse.vehicle.id, suffix);
  const requestResponse = await createTripRequest(
    passenger.accessToken,
    tripResponse.trip.id,
    suffix,
  );

  const driverContext = await browser.newContext();
  const passengerContext = await browser.newContext();
  const adminContext = await browser.newContext();

  const driverPage = await driverContext.newPage();
  const passengerPage = await passengerContext.newPage();
  const adminPage = await adminContext.newPage();

  try {
    await signInThroughUi(driverPage, driver.email, driver.password);
    await driverPage.goto('/viajes/aprobar-solicitudes?experienceMode=driver');
    await waitForSectionHeading(driverPage, 'Aprobar solicitudes', 'Cargando solicitudes');

    const incomingRequestCard = driverPage
      .locator('article')
      .filter({ hasText: passenger.fullName })
      .filter({ hasText: tripResponse.trip.originLabel })
      .first();
    await expect(incomingRequestCard).toBeVisible();
    await incomingRequestCard.getByRole('button', { name: 'Aceptar' }).click();
    await expect(driverPage.getByText('Solicitud aceptada correctamente.')).toBeVisible();

    await startTrip(driver.accessToken, tripResponse.trip.id);
    await markTripRequestBoarded(driver.accessToken, requestResponse.tripRequest.id);
    await markTripRequestDroppedOff(driver.accessToken, requestResponse.tripRequest.id);
    await completeTrip(driver.accessToken, tripResponse.trip.id);

    await signInThroughUi(passengerPage, passenger.email, passenger.password);
    await passengerPage.goto(`/confianza?focus=rating&tripId=${tripResponse.trip.id}`);
    await waitForSectionHeading(passengerPage, 'Reputación y seguridad', 'Cargando confianza');

    const ratingCard = passengerPage
      .locator('div')
      .filter({ hasText: driver.fullName })
      .filter({ hasText: 'Calificar al conductor' })
      .first();
    await expect(ratingCard).toBeVisible();
    await ratingCard.getByRole('button', { name: 'Calificar' }).click();
    await passengerPage.getByLabel('Comentario').fill(`Calificacion E2E ${suffix}`);
    await passengerPage.getByRole('button', { name: 'Registrar' }).click();
    await expect(passengerPage.getByText('Calificacion registrada correctamente.')).toBeVisible();

    await createReport(
      passenger.accessToken,
      tripResponse.trip.id,
      driver.membershipId,
      suffix,
    );

    await signInThroughUi(adminPage, 'admin@uta.edu.ec', 'Admin12345');
    await adminPage.goto('/moderacion?section=reports');
    await waitForSectionHeading(adminPage, 'Centro de Moderación', 'Cargando moderacion');
    await adminPage.getByRole('button', { name: /Reportes/ }).click();

    const reportRow = adminPage.locator('tr').filter({ hasText: driver.fullName }).first();
    await expect(reportRow).toBeVisible();
    await reportRow.getByRole('button', { name: 'Revisar' }).click();
    await adminPage.getByLabel(/Nota Administrativa/i).fill(`Revision E2E ${suffix}`);
    await adminPage.getByRole('button', { name: 'Marcar en revision' }).click();
    await expect(adminPage.getByText('Reporte revisado correctamente.')).toBeVisible();
  } finally {
    await Promise.allSettled([
      driverContext.close(),
      passengerContext.close(),
      adminContext.close(),
    ]);
  }
});
