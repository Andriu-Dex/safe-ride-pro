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

    const availableTripCard = strongCardByText(
      passengerPage,
      `${tripResponse.trip.originLabel} -> ${tripResponse.trip.destinationLabel}`,
    );
    await expect(availableTripCard).toBeVisible();
    await availableTripCard.getByLabel('Mensaje para el conductor').fill(`Solicitud E2E ${suffix}`);
    await availableTripCard.getByRole('button', { name: 'Solicitar cupo' }).click();
    await expect(passengerPage.getByText('Solicitud enviada correctamente.')).toBeVisible();

    await signInThroughUi(driverPage, driver.email, driver.password);
    await openSidebarSection(driverPage, 'Viajes');
    await waitForSectionHeading(driverPage, 'Viajes', 'Preparando viajes y solicitudes');

    const incomingRequestCard = listCardByText(driverPage, passenger.fullName);
    await expect(incomingRequestCard).toBeVisible();
    await incomingRequestCard.getByRole('button', { name: 'Aceptar' }).click();
    await expect(driverPage.getByText('Solicitud aceptada correctamente.')).toBeVisible();

    const myTripCard = listCardByText(
      driverPage,
      `${tripResponse.trip.originLabel} -> ${tripResponse.trip.destinationLabel}`,
    );
    await expect(myTripCard).toBeVisible();
    await myTripCard.getByRole('button', { name: 'Iniciar' }).click();
    await expect(driverPage.getByText('Viaje iniciado correctamente.')).toBeVisible();
    await myTripCard.getByRole('button', { name: 'Finalizar' }).click();
    await expect(driverPage.getByText('Viaje finalizado correctamente.')).toBeVisible();

    await passengerPage.goto('/confianza');
    await expect(passengerPage).toHaveURL(/\/confianza$/);
    await waitForSectionHeading(passengerPage, 'Confianza', 'Cargando confianza y seguridad');
    const ratingCard = strongCardByText(passengerPage, driver.fullName);
    await expect(ratingCard).toBeVisible();
    await ratingCard.getByLabel('Comentario').fill(`Calificacion E2E ${suffix}`);
    await ratingCard.getByRole('button', { name: 'Registrar calificacion' }).click();
    await expect(passengerPage.getByText('Calificacion registrada correctamente.')).toBeVisible();

    const reportCard = listCardByText(passengerPage, driver.fullName);
    await reportCard.getByLabel('Descripcion').fill(`Reporte E2E ${suffix}`);
    await reportCard.getByLabel('Referencia de evidencia').fill(`evidencia-e2e-${suffix}`);
    await reportCard.getByRole('button', { name: 'Registrar reporte' }).click();
    await expect(passengerPage.getByText('Reporte registrado correctamente.')).toBeVisible();

    await signInThroughUi(adminPage, 'admin@uta.edu.ec', 'Admin12345');
    await openSidebarSection(adminPage, 'Auditoria');
    await waitForSectionHeading(adminPage, 'Auditoria', 'Cargando auditoria');

    const reportReviewCard = listCardByText(adminPage, `Reporte E2E ${suffix}`);
    await expect(reportReviewCard).toBeVisible();
    await reportReviewCard.getByLabel('Nota administrativa').fill(`Revision E2E ${suffix}`);
    await reportReviewCard.getByRole('button', { name: 'Marcar en revision' }).click();
    await expect(adminPage.getByText('Reporte revisado correctamente.')).toBeVisible();
  } finally {
    await Promise.all([
      driverContext.close(),
      passengerContext.close(),
      adminContext.close(),
    ]);
  }
});
