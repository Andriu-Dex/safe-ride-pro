import { expect, test } from '@playwright/test';

import {
  approveDriverApplication,
  createPublishedTrip,
  loginSeedAdmin,
  registerVehicle,
  registerVerifiedUser,
  submitDriverApplication,
} from '../support/api';
import {
  listCardByText,
  openSidebarSection,
  signInThroughUi,
  strongCardByText,
  waitForSectionHeading,
} from '../support/ui';

test('pasajero, conductor y admin completan el flujo critico de solicitud, confianza y auditoria', async ({ browser }) => {
  test.setTimeout(180_000);
  const suffix = `${Date.now()}`;
  const adminSession = await loginSeedAdmin();
  const driver = await registerVerifiedUser('driver-flow');
  const passenger = await registerVerifiedUser('passenger-flow');

  await submitDriverApplication(driver.accessToken, suffix);
  await approveDriverApplication(adminSession.accessToken, driver.membershipId);
  const vehicleResponse = await registerVehicle(driver.accessToken, suffix);
  const tripResponse = await createPublishedTrip(driver.accessToken, vehicleResponse.vehicle.id, suffix);

  const driverContext = await browser.newContext();
  const passengerContext = await browser.newContext();
  const adminContext = await browser.newContext();

  const driverPage = await driverContext.newPage();
  const passengerPage = await passengerContext.newPage();
  const adminPage = await adminContext.newPage();

  try {
    await signInThroughUi(passengerPage, passenger.email, passenger.password);
    await openSidebarSection(passengerPage, 'Viajes');
    await waitForSectionHeading(passengerPage, 'Viajes', 'Preparando viajes y solicitudes');
    await passengerPage
      .locator('.journey-workspace-nav')
      .getByRole('button', { name: /Explorar/i })
      .click();
    await expect(
      passengerPage.getByRole('heading', { name: 'Explorar cupos', exact: true }),
    ).toBeVisible();

    const availableTripCard = passengerPage
      .locator('.trip-overview-card')
      .filter({ hasText: tripResponse.trip.originLabel })
      .filter({ hasText: tripResponse.trip.destinationLabel })
      .first();
    await expect(availableTripCard).toBeVisible();
    await availableTripCard
      .getByRole('button', { name: /Solicitar este viaje|Solicitud registrada/ })
      .click();
    await availableTripCard.getByLabel('Mensaje').fill(`Solicitud E2E ${suffix}`);
    await availableTripCard.getByRole('button', { name: 'Solicitar cupo' }).click();
    await expect(passengerPage.getByText('Solicitud enviada correctamente.')).toBeVisible();

    await signInThroughUi(driverPage, driver.email, driver.password);
    await openSidebarSection(driverPage, 'Viajes');
    await waitForSectionHeading(driverPage, 'Viajes', 'Preparando viajes y solicitudes');
    await driverPage
      .locator('.journey-workspace-nav')
      .getByRole('button', { name: /Solicitudes/i })
      .click();
    await expect(
      driverPage.getByRole('heading', { name: 'Solicitudes recibidas', exact: true }),
    ).toBeVisible();

    const incomingRequestCard = listCardByText(driverPage, passenger.fullName);
    await expect(incomingRequestCard).toBeVisible();
    await incomingRequestCard.getByRole('button', { name: 'Aceptar' }).click();
    await expect(driverPage.getByText('Solicitud aceptada correctamente.')).toBeVisible();

    await driverPage
      .locator('.journey-workspace-nav')
      .getByRole('button', { name: /Operacion/i })
      .click();
    await expect(
      driverPage.getByRole('heading', { name: 'Mis viajes', exact: true }),
    ).toBeVisible();

    const myTripCard = driverPage
      .locator('.trip-overview-card')
      .filter({ hasText: tripResponse.trip.originLabel })
      .filter({ hasText: tripResponse.trip.destinationLabel })
      .first();
    await expect(myTripCard).toBeVisible();
    await myTripCard.getByRole('button', { name: 'Iniciar' }).click();
    await expect(driverPage.getByText('Viaje iniciado correctamente.')).toBeVisible();
    await myTripCard.getByRole('button', { name: 'Finalizar' }).click();
    await expect(driverPage.getByText('Viaje finalizado correctamente.')).toBeVisible();

    await passengerPage.goto('/confianza');
    await expect(passengerPage).toHaveURL(/\/confianza$/);
    await waitForSectionHeading(
      passengerPage,
      'Reputacion y cierre operativo',
      'Cargando confianza y seguridad',
    );
    const ratingCard = strongCardByText(passengerPage, driver.fullName);
    await expect(ratingCard).toBeVisible();
    await ratingCard.getByLabel('Comentario').fill(`Calificacion E2E ${suffix}`);
    await ratingCard.getByRole('button', { name: 'Registrar calificacion' }).click();
    await expect(passengerPage.getByText('Calificacion registrada correctamente.')).toBeVisible();

    const reportCard = listCardByText(passengerPage, driver.fullName);
    await reportCard.getByLabel('Descripcion').fill(`Reporte E2E ${suffix}`);
    await reportCard
      .locator('.document-upload-card')
      .filter({ hasText: 'Evidencia del reporte' })
      .locator('input[type="file"]')
      .setInputFiles({
        name: `report-evidence-${suffix}.png`,
        mimeType: 'image/png',
        buffer: Buffer.from('89504E470D0A1A0A', 'hex'),
      });
    await reportCard.getByRole('button', { name: 'Registrar reporte' }).click();
    await expect(passengerPage.getByText('Reporte registrado correctamente.')).toBeVisible();

    await signInThroughUi(adminPage, 'admin@uta.edu.ec', 'Admin12345');
    await openSidebarSection(adminPage, 'Auditoria');
    await waitForSectionHeading(adminPage, 'Auditoria institucional', 'Cargando auditoria');

    const reportReviewCard = listCardByText(adminPage, `Reporte E2E ${suffix}`);
    await expect(reportReviewCard).toBeVisible();
    await reportReviewCard.getByText('Gestionar reporte').click();
    await reportReviewCard.getByLabel('Nota administrativa').fill(`Revision E2E ${suffix}`);
    await reportReviewCard.getByRole('button', { name: 'Marcar en revision' }).click();
    await expect(adminPage.getByText('Reporte revisado correctamente.')).toBeVisible();
  } finally {
    await Promise.allSettled([
      driverContext.close(),
      passengerContext.close(),
      adminContext.close(),
    ]);
  }
});
