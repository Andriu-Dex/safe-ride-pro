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

  // Mock de las APIs de Geoapify para evitar depender de servicios externos y garantizar robustez
  await page.route('**/api.geoapify.com/v1/geocode/autocomplete*', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('text') || '';
    const isOrigin = query.toLowerCase().includes('origen');
    
    const suggestion = isOrigin 
      ? {
          properties: {
            place_id: 'origin-id',
            address_line1: `Origen E2E ${suffix}`,
            formatted: `Origen E2E ${suffix}, Ambato, Ecuador`,
            lat: -1.2414,
            lon: -78.6278
          },
          geometry: {
            coordinates: [-78.6278, -1.2414]
          }
        }
      : {
          properties: {
            place_id: 'destination-id',
            address_line1: `Destino E2E ${suffix}`,
            formatted: `Destino E2E ${suffix}, Ambato, Ecuador`,
            lat: -1.2500,
            lon: -78.6300
          },
          geometry: {
            coordinates: [-78.6300, -1.2500]
          }
        };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        features: [suggestion]
      })
    });
  });

  await page.route('**/api.geoapify.com/v1/geocode/reverse*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        features: [
          {
            properties: {
              address_line1: 'Mocked Reverse Geocode Location',
              formatted: 'Mocked Reverse Geocode Location, Ambato, Ecuador',
              lat: -1.2414,
              lon: -78.6278
            }
          }
        ]
      })
    });
  });

  await page.route('**/api.geoapify.com/v1/routing*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        features: [
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [-78.6278, -1.2414],
                [-78.6300, -1.2500]
              ]
            },
            properties: {
              distance: 1200,
              time: 300
            }
          }
        ]
      })
    });
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

  const autocompleteField = page.locator('.place-autocomplete-field').first();
  const isMapsEnabled = await autocompleteField.isVisible();

  if (isMapsEnabled) {
    // Rellenar Origen con autocompletado
    const originInput = page.getByLabel('Origen', { exact: true });
    await originInput.fill(`Origen E2E ${suffix}`);
    
    // Esperar a que la lista de sugerencias sea visible
    const results = page.locator('.place-autocomplete-results');
    await expect(results).toBeVisible({ timeout: 5000 });
    
    // Despachar evento 'mousedown' para disparar el manejador de React
    await page.locator('.place-autocomplete-option').first().dispatchEvent('mousedown');
    
    // Esperar a que las sugerencias se oculten para confirmar la selección
    await expect(results).toBeHidden({ timeout: 3000 });

    // Rellenar Destino con autocompletado
    const destinationInput = page.getByLabel('Destino', { exact: true });
    await destinationInput.fill(`Destino E2E ${suffix}`);
    
    await expect(results).toBeVisible({ timeout: 5000 });
    await page.locator('.place-autocomplete-option').first().dispatchEvent('mousedown');
    await expect(results).toBeHidden({ timeout: 3000 });
  } else {
    // Ingresar origen, destino y coordenadas manualmente (Maps deshabilitado)
    await page.getByLabel('Origen', { exact: true }).fill(`Origen E2E ${suffix}`);
    await page.getByLabel('Destino', { exact: true }).fill(`Destino E2E ${suffix}`);
    
    await page.getByLabel('Latitud origen').fill('-1.2414');
    await page.getByLabel('Longitud origen').fill('-78.6278');
    await page.getByLabel('Latitud destino').fill('-1.2500');
    await page.getByLabel('Longitud destino').fill('-78.6300');
  }

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
