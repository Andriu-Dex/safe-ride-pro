import { expect, test } from '@playwright/test';

import { approveDriverApplication, loginSeedAdmin, registerVerifiedUser } from '../support/api';
import {
  createLocalDateTimeInput,
  openSidebarSection,
  signInThroughUi,
  waitForSectionHeading,
} from '../support/ui';

test('un conductor puede enviar solicitud, registrar vehiculo y publicar un viaje', async ({ page }) => {
  const suffix = `${Date.now()}`;
  const driver = await registerVerifiedUser('driver-e2e');

  await signInThroughUi(page, driver.email, driver.password);

  await openSidebarSection(page, 'Conductor');
  await expect(page).toHaveURL(/\/conductor$/);
  await waitForSectionHeading(page, 'Habilitacion operativa', 'Cargando estado de conductor');
  await page.getByLabel('Tipo de licencia').selectOption({ index: 1 });
  await page.getByLabel('Fecha de expiracion').fill('2030-12-31');
  await page
    .locator('.document-upload-card')
    .filter({ hasText: 'Documento de identidad' })
    .locator('input[type="file"]')
    .setInputFiles({
    name: `identity-${suffix}.png`,
    mimeType: 'image/png',
    buffer: Buffer.from('89504E470D0A1A0A', 'hex'),
  });
  await page
    .locator('.document-upload-card')
    .filter({ hasText: 'Documento de licencia' })
    .locator('input[type="file"]')
    .setInputFiles({
    name: `license-${suffix}.png`,
    mimeType: 'image/png',
    buffer: Buffer.from('89504E470D0A1A0A', 'hex'),
  });
  const submitDriverApplicationButton = page.getByRole('button', {
    name: /Enviar solicitud|Actualizar solicitud|Reenviar solicitud/,
  });
  await expect(submitDriverApplicationButton).toBeEnabled();
  await submitDriverApplicationButton.click();
  await expect(page.getByText('Tu solicitud de conductor fue enviada y esta pendiente de revision.')).toBeVisible();

  const adminSession = await loginSeedAdmin();
  await approveDriverApplication(adminSession.accessToken, driver.membershipId);

  await openSidebarSection(page, 'Vehiculos');
  await expect(page).toHaveURL(/\/vehiculos$/);
  await waitForSectionHeading(page, 'Gestion de vehiculos', 'Cargando vehiculos');
  await page.locator('.field-panel').filter({ hasText: 'Marca' }).getByRole('button', { name: 'Ingresar manualmente' }).click();
  await page.locator('.field-panel').filter({ hasText: 'Modelo' }).getByRole('button', { name: 'Ingresar manualmente' }).click();
  await page.getByLabel('Anio').fill('2025');
  await page.locator('.field-panel').filter({ hasText: 'Marca' }).locator('input').fill(`Marca E2E ${suffix}`);
  await page.locator('.field-panel').filter({ hasText: 'Modelo' }).locator('input').fill(`Modelo E2E ${suffix}`);
  await page.getByLabel('Color').fill('Negro');
  await page.getByLabel('Placa').fill(`QA${suffix.slice(-4)}A`);
  await page.getByLabel('Capacidad').fill('4');
  await page
    .locator('.document-upload-card')
    .filter({ hasText: 'Documento de matricula' })
    .locator('input[type="file"]')
    .setInputFiles({
      name: `registration-${suffix}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from('89504E470D0A1A0A', 'hex'),
    });
  const registerVehicleButton = page.getByRole('button', { name: 'Registrar vehiculo' });
  await expect(registerVehicleButton).toBeEnabled();
  await registerVehicleButton.click();
  await expect(page.getByText('Vehiculo registrado correctamente.')).toBeVisible();
  await expect(page.getByText(`Marca E2E ${suffix} Modelo E2E ${suffix}`)).toBeVisible();

  await openSidebarSection(page, 'Viajes');
  await expect(page).toHaveURL(/\/viajes$/);
  await waitForSectionHeading(page, 'Viajes', 'Preparando viajes y solicitudes');
  await page.getByRole('button', { name: 'Nuevo viaje', exact: true }).first().click();
  await expect(page).toHaveURL(/\/viajes\/nuevo$/);
  await expect(page.getByRole('heading', { name: 'Nuevo viaje', exact: true })).toBeVisible();

  await page.getByRole('combobox', { name: 'Vehiculo', exact: true }).selectOption({ index: 1 });
  await page.getByRole('textbox', { name: 'Origen', exact: true }).fill(`Origen web ${suffix}`);
  await page.getByRole('textbox', { name: 'Destino', exact: true }).fill(`Destino web ${suffix}`);
  await page.getByRole('spinbutton', { name: 'Latitud origen', exact: true }).fill('-1.24908');
  await page.getByRole('spinbutton', { name: 'Longitud origen', exact: true }).fill('-78.61675');
  await page.getByRole('spinbutton', { name: 'Latitud destino', exact: true }).fill('-1.26184');
  await page.getByRole('spinbutton', { name: 'Longitud destino', exact: true }).fill('-78.62089');
  await page.getByRole('textbox', { name: 'Salida', exact: true }).fill(createLocalDateTimeInput(2, 2));
  await page.getByRole('textbox', { name: 'Llegada estimada', exact: true }).fill(createLocalDateTimeInput(2, 3));
  await page.getByRole('spinbutton', { name: 'Cupos', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: 'Precio base', exact: true }).fill('2.50');
  await page.getByLabel('Notas').fill(`Viaje de prueba ${suffix}`);
  await page.getByRole('button', { name: 'Guardar viaje', exact: true }).click();
  await expect(page.getByText('Viaje creado en borrador correctamente.').first()).toBeVisible();

  await page.getByRole('button', { name: 'Volver a viajes', exact: true }).click();
  await expect(page).toHaveURL(/\/viajes$/);

  const tripCard = page
    .locator('article')
    .filter({
      has: page.getByRole('heading', {
        name: new RegExp(`Origen web ${suffix}.*Destino web ${suffix}`),
      }),
    })
    .first();
  await expect(tripCard).toBeVisible();
  await tripCard.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Viaje publicado correctamente.').first()).toBeVisible();
  await expect(tripCard.getByRole('button', { name: 'Iniciar' })).toBeVisible();
});
