import { expect, test } from '@playwright/test';

import {
  approveDriverApplication,
  createPublishedTrip,
  loginSeedAdmin,
  registerVehicle,
  registerVerifiedUser,
  submitDriverApplication,
} from '../support/api';
import { signInThroughUi, waitForSectionHeading } from '../support/ui';

test('un conductor puede enviar solicitud, registrar vehiculo y publicar un viaje', async ({ page }) => {
  const suffix = `${Date.now()}`;
  const driver = await registerVerifiedUser('driver-e2e');

  await signInThroughUi(page, driver.email, driver.password);

  await page.goto('/conductor');
  await expect(page).toHaveURL(/\/conductor$/);
  await waitForSectionHeading(page, 'Tu estado operativo', 'Cargando estado de conductor');
  await expect(page.getByRole('button', { name: 'Crear solicitud' })).toBeVisible();

  const adminSession = await loginSeedAdmin();
  await submitDriverApplication(driver.accessToken, suffix);
  await approveDriverApplication(adminSession.accessToken, driver.membershipId);

  await page.goto('/vehiculos?experienceMode=driver');
  await expect(page).toHaveURL(/\/vehiculos/);
  await waitForSectionHeading(page, 'Gestiona tus vehiculos', 'Cargando vehiculos');
  const vehicleResponse = await registerVehicle(driver.accessToken, suffix);
  await page.reload();
  await expect(page.getByText(`Marca E2E ${suffix} Modelo E2E ${suffix}`)).toBeVisible();
  const tripResponse = await createPublishedTrip(
    driver.accessToken,
    vehicleResponse.vehicle.id,
    suffix,
  );

  await page.goto('/viajes?experienceMode=driver');
  await expect(page).toHaveURL(/\/viajes/);
  await expect(page.getByRole('heading', { name: 'Mis viajes' }).first()).toBeVisible();

  const tripCard = page
    .locator('article')
    .filter({
      has: page.getByRole('heading', {
        name: new RegExp(`${tripResponse.trip.originLabel}.*${tripResponse.trip.destinationLabel}`),
      }),
    })
    .first();
  await expect(tripCard).toBeVisible();
  await expect(tripCard.getByRole('button', { name: 'Iniciar' })).toBeVisible();
});
