import { expect, test } from '@playwright/test';
import {
  approveDriverApplication,
  loginSeedAdmin,
  registerVehicle,
  registerVerifiedUser,
  submitDriverApplication,
  createPublishedTrip,
} from '../support/api';
import { signInThroughUi } from '../support/ui';

test('pasajero puede solicitar viaje por UI y conductor aprobar la solicitud por UI', async ({
  browser,
}) => {
  const suffix = `${Date.now()}`;
  const driver = await registerVerifiedUser('req-dr');
  const passenger = await registerVerifiedUser('req-pa');

  // Seed: driver aprobado y vehiculo
  const adminSession = await loginSeedAdmin();
  await submitDriverApplication(driver.accessToken, suffix);
  await approveDriverApplication(adminSession.accessToken, driver.membershipId);
  const vehicleResponse = await registerVehicle(driver.accessToken, suffix);

  // Seed: viaje publicado
  await createPublishedTrip(driver.accessToken, vehicleResponse.vehicle.id, suffix);

  // --- PASAJERO ENVIA LA SOLICITUD ---
  const passengerContext = await browser.newContext();
  const passengerPage = await passengerContext.newPage();
  await signInThroughUi(passengerPage, passenger.email, passenger.password);

  // Ir a viajes disponibles
  await passengerPage.goto('/viajes');
  await expect(passengerPage.getByRole('heading', { name: 'Viajes disponibles' })).toBeVisible();

  // Buscar la tarjeta del viaje (buscamos un article que tenga la clase tripRow)
  const tripCard = passengerPage
    .locator('article[class*="tripRow"]')
    .filter({ hasText: suffix })
    .first();
  // Esperar a que la lista de viajes cargue al menos un elemento
  await passengerPage.waitForSelector('article[class*="tripRow"]', { state: 'visible' });

  let isTripVisible = false;
  for (let i = 0; i < 5; i++) {
    // Dar un pequeno tiempo extra en cada pagina por si hay un re-render
    await passengerPage.waitForTimeout(500);
    
    if (await tripCard.isVisible()) {
      isTripVisible = true;
      break;
    }

    const nextButton = passengerPage.getByRole('button', { name: 'Siguiente' });
    if (await nextButton.isDisabled()) {
      break;
    }

    await nextButton.click();
    await passengerPage.waitForTimeout(1000); // Dar tiempo a que cargue la siguiente pagina
  }

  await expect(tripCard).toBeVisible();

  // Hacer click en "Solicitar"
  const requestButton = tripCard.getByRole('button', { name: 'Solicitar' });
  await expect(requestButton).toBeVisible();
  await requestButton.click();

  // Se abre el modal. Rellenar mensaje
  await passengerPage.getByLabel('Mensaje').fill(`Mensaje E2E ${suffix}`);

  // Marcar checkbox de confirmacion previa (reglas)
  await passengerPage.locator('input[type="checkbox"]').first().check();

  // Click en "Confirmar solicitud"
  await passengerPage.getByRole('button', { name: 'Confirmar solicitud' }).click();

  // Verificar que el boton en la tarjeta cambia a "Gestionar" (lo que indica que la solicitud esta activa)
  await expect(tripCard.getByRole('button', { name: 'Gestionar' })).toBeVisible();

  // --- CONDUCTOR INICIA SESION Y APRUEBA LA SOLICITUD ---
  const driverContext = await browser.newContext();
  const driverPage = await driverContext.newPage();
  await signInThroughUi(driverPage, driver.email, driver.password);

  // Ir a aprobar solicitudes
  await driverPage.goto('/viajes/aprobar-solicitudes');
  await expect(driverPage.getByRole('heading', { level: 1, name: 'Aprobar solicitudes' })).toBeVisible();

  // Buscar la fila correspondiente al pasajero
  const passengerRow = driverPage
    .locator('tr')
    .filter({
      hasText: passenger.fullName,
    })
    .first();
  await expect(passengerRow).toBeVisible();

  // Deberia haber un boton con el titulo "Aceptar solicitud"
  const acceptRequestBtn = passengerRow.locator('button[title="Aceptar solicitud"]');
  await expect(acceptRequestBtn).toBeVisible();
  await acceptRequestBtn.click();

  // Verificar que el estado cambie a "Aceptada"
  await expect(passengerRow.getByText('Aceptada')).toBeVisible();

  // Cerrar contextos
  await passengerContext.close();
  await driverContext.close();
});
