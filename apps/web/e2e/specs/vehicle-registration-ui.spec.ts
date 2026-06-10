import { expect, test } from '@playwright/test';
import {
  approveDriverApplication,
  loginSeedAdmin,
  registerVerifiedUser,
  submitDriverApplication,
} from '../support/api';
import { signInThroughUi, waitForSectionHeading } from '../support/ui';

test('un conductor aprobado puede registrar un vehiculo por UI', async ({ page }) => {
  const suffix = `${Date.now()}`;
  const driver = await registerVerifiedUser('veh-drv');

  // Registrar conductor via API para establecer la precondicion
  const adminSession = await loginSeedAdmin();
  await submitDriverApplication(driver.accessToken, suffix);
  await approveDriverApplication(adminSession.accessToken, driver.membershipId);

  // Iniciar sesion
  await signInThroughUi(page, driver.email, driver.password);

  // Ir a vehiculos
  await page.goto('/vehiculos?experienceMode=driver');
  await expect(page).toHaveURL(/\/vehiculos/);
  await waitForSectionHeading(page, 'Gestiona tus vehiculos', 'Cargando vehiculos');

  // Hacer clic en Registrar vehiculo
  await page.locator('header').getByRole('button', { name: 'Registrar vehiculo' }).click();

  // Rellenar formulario del modal
  await page.getByLabel('Tipo de vehiculo').selectOption('CAR');
  await page.getByLabel('Anio').fill('2025');

  // Ingresar marca y modelo manualmente
  await page.getByRole('button', { name: 'Ingresar manualmente' }).first().click();
  await page.getByPlaceholder('Ej. Kia').fill(`Brand E2E ${suffix}`);

  await page.getByRole('button', { name: 'Ingresar manualmente' }).first().click();
  await page.getByPlaceholder('Ej. Rio').fill(`Model E2E ${suffix}`);

  await page.getByLabel('Color').fill('Azul');
  // Generar placa unica valida para Ecuador (ej. PAA-1234)
  const plateSuffix = suffix.slice(-4);
  await page.getByLabel('Placa').fill(`PAA-${plateSuffix}`);

  await page.getByLabel('Cupos').fill('4');
  await page.getByLabel('Equipaje').selectOption({ index: 1 });

  // Simular la subida del documento de matricula
  const dummyFile = {
    name: 'matricula.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from([0]),
  };
  await page.locator('input[type="file"]').setInputFiles(dummyFile);
  await expect(page.getByText('Documento cargado')).toBeVisible();

  // Registrar vehiculo
  await page.locator('form').getByRole('button', { name: 'Registrar vehiculo' }).click();

  // Verificar que el vehiculo aparece en el listado
  await expect(page.getByText(`Brand E2E ${suffix} Model E2E ${suffix}`)).toBeVisible();
});
