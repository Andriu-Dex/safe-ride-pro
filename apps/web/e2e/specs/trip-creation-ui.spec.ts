import { expect, test } from '@playwright/test';
import {
  approveDriverApplication,
  loginSeedAdmin,
  registerVehicle,
  registerVerifiedUser,
  submitDriverApplication,
} from '../support/api';
import { createLocalDateTimeInput, signInThroughUi, waitForSectionHeading } from '../support/ui';

test('un conductor aprobado puede crear un viaje completo por UI y publicarlo', async ({ page }) => {
  const suffix = `${Date.now()}`;
  const driver = await registerVerifiedUser('trip-create');

  page.on('request', request => {
    if (request.url().includes('/trips') && request.method() === 'POST') {
      console.log(`[NETWORK REQ] ${request.method()} ${request.url()}`);
    }
  });

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.log(`[BROWSER ERROR] ${error.name}: ${error.message}`);
  });

  // Seed: conductor aprobado con vehículo
  const adminSession = await loginSeedAdmin();
  await submitDriverApplication(driver.accessToken, suffix);
  await approveDriverApplication(adminSession.accessToken, driver.membershipId);
  await registerVehicle(driver.accessToken, suffix);

  // Login como conductor
  await signInThroughUi(page, driver.email, driver.password);

  // Navegar a la página de creación de viaje
  await page.goto('/viajes/nuevo?experienceMode=driver');
  await expect(page.getByRole('heading', { name: 'Nuevo viaje' })).toBeVisible();

  // Verificar que muestra "Listo para crear"
  await expect(page.getByText('Listo para crear')).toBeVisible();

  // Rellenar formulario completo
  // Ingresar descripcion de ubicacion
  await page.getByLabel('Origen', { exact: true }).fill(`Origen E2E ${suffix}`);
  await page.getByLabel('Destino', { exact: true }).fill(`Destino E2E ${suffix}`);

  // Ingresar coordenadas manualmente
  await page.getByLabel('Latitud origen').fill('-1.2414');
  await page.getByLabel('Longitud origen').fill('-78.6278');
  await page.getByLabel('Latitud destino').fill('-1.2500');
  await page.getByLabel('Longitud destino').fill('-78.6300');

  const departureDatetime = createLocalDateTimeInput(1, 2);
  const arrivalDatetime = createLocalDateTimeInput(1, 3);

  await page.getByLabel('Salida').fill(departureDatetime);
  await page.getByLabel('Llegada estimada').fill(arrivalDatetime);
  await page.getByLabel('Cupos').fill('3');
  await page.getByLabel('Precio base').fill('2.50');

  // Enviar formulario
  await page.getByRole('button', { name: 'Crear viaje' }).click();

  // Debería redirigir a /viajes y mostrar toast de éxito
  await expect(page).toHaveURL(/\/viajes/, { timeout: 10_000 });

  // Verificar que el viaje aparece en el listado
  const tripCard = page.locator('article[class*="tripCard"]').first().or(page.locator('article').first());
  await expect(tripCard).toBeVisible();

  // Verificar que tiene botón "Publicar" (estado borrador)
  await expect(tripCard.getByRole('button', { name: 'Publicar' })).toBeVisible();

  // Publicar el viaje
  await tripCard.getByRole('button', { name: 'Publicar' }).click();

  // Verificar que el estado cambió a "Publicado"
  await expect(tripCard.getByText('Publicado')).toBeVisible();
});
