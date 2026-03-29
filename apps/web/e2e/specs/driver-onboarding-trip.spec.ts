import { expect, test } from '@playwright/test';

import { approveDriverApplication, loginSeedAdmin, registerVerifiedUser } from '../support/api';
import {
  createLocalDateTimeInput,
  listCardByText,
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
  await waitForSectionHeading(page, 'Conductor', 'Cargando estado de conductor');
  await page.getByLabel('Tipo de licencia').selectOption({ index: 1 });
  await page.getByLabel('Numero de licencia').fill(`DRV-${suffix}`);
  await page.getByLabel('Fecha de expiracion').fill('2030-12-31');
  await page.getByLabel('Clave del documento de identidad').fill(`identity-${suffix}`);
  await page.getByLabel('Clave del documento de licencia').fill(`license-${suffix}`);
  await page.getByRole('button', { name: /Enviar solicitud|Actualizar solicitud|Reenviar solicitud/ }).click();
  await expect(page.getByText('Tu solicitud de conductor fue enviada y esta pendiente de revision.')).toBeVisible();

  const adminSession = await loginSeedAdmin();
  await approveDriverApplication(adminSession.accessToken, driver.membershipId);

  await openSidebarSection(page, 'Vehiculos');
  await expect(page).toHaveURL(/\/vehiculos$/);
  await waitForSectionHeading(page, 'Vehiculos', 'Cargando vehiculos');
  await page.locator('.field-panel').filter({ hasText: 'Marca' }).getByRole('button', { name: 'Ingresar manualmente' }).click();
  await page.locator('.field-panel').filter({ hasText: 'Modelo' }).getByRole('button', { name: 'Ingresar manualmente' }).click();
  await page.getByLabel('Anio').fill('2025');
  await page.locator('.field-panel').filter({ hasText: 'Marca' }).locator('input').fill(`Marca E2E ${suffix}`);
  await page.locator('.field-panel').filter({ hasText: 'Modelo' }).locator('input').fill(`Modelo E2E ${suffix}`);
  await page.getByLabel('Color').fill('Negro');
  await page.getByLabel('Placa').fill(`QA${suffix.slice(-4)}A`);
  await page.getByLabel('Capacidad').fill('4');
  await page.getByRole('button', { name: 'Registrar vehiculo' }).click();
  await expect(page.getByText('Vehiculo registrado correctamente.')).toBeVisible();
  await expect(page.getByText(`Marca E2E ${suffix} Modelo E2E ${suffix}`)).toBeVisible();

  await openSidebarSection(page, 'Viajes');
  await expect(page).toHaveURL(/\/viajes$/);
  await waitForSectionHeading(page, 'Viajes', 'Preparando viajes y solicitudes');
  const tripCreationPanel = page.locator('article').filter({
    has: page.getByRole('heading', { name: 'Crear viaje', exact: true }),
  });

  await tripCreationPanel.getByRole('combobox', { name: 'Vehiculo', exact: true }).selectOption({ index: 1 });
  await tripCreationPanel.getByRole('textbox', { name: 'Origen', exact: true }).fill(`Origen web ${suffix}`);
  await tripCreationPanel.getByRole('textbox', { name: 'Destino', exact: true }).fill(`Destino web ${suffix}`);
  await tripCreationPanel.getByRole('spinbutton', { name: 'Latitud origen', exact: true }).fill('-1.24908');
  await tripCreationPanel.getByRole('spinbutton', { name: 'Longitud origen', exact: true }).fill('-78.61675');
  await tripCreationPanel.getByRole('spinbutton', { name: 'Latitud destino', exact: true }).fill('-1.26184');
  await tripCreationPanel.getByRole('spinbutton', { name: 'Longitud destino', exact: true }).fill('-78.62089');
  await tripCreationPanel.getByRole('textbox', { name: 'Salida', exact: true }).fill(createLocalDateTimeInput(2, 2));
  await tripCreationPanel.getByRole('textbox', { name: 'Llegada estimada', exact: true }).fill(createLocalDateTimeInput(2, 3));
  await tripCreationPanel.getByRole('spinbutton', { name: 'Cupos', exact: true }).fill('2');
  await tripCreationPanel.getByRole('spinbutton', { name: 'Precio base', exact: true }).fill('2.50');
  await tripCreationPanel.getByPlaceholder('Indicaciones adicionales del viaje').fill(`Viaje de prueba ${suffix}`);
  await tripCreationPanel.getByRole('button', { name: 'Crear viaje', exact: true }).click();
  await expect(page.getByText('Viaje creado en borrador correctamente.')).toBeVisible();

  const tripCard = listCardByText(page, `Origen web ${suffix} -> Destino web ${suffix}`);
  await expect(tripCard).toBeVisible();
  await tripCard.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Viaje publicado correctamente.')).toBeVisible();
  await expect(tripCard.getByRole('button', { name: 'Iniciar' })).toBeVisible();
});
