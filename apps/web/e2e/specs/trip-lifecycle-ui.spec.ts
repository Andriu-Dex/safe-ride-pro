import { expect, test } from '@playwright/test';
import {
  acceptTripRequest,
  approveDriverApplication,
  createPublishedTrip,
  createTripRequest,
  loginSeedAdmin,
  registerVehicle,
  registerVerifiedUser,
  startTrip,
  submitDriverApplication,
} from '../support/api';
import { signInThroughUi } from '../support/ui';

test('ciclo de vida de un viaje (iniciar, abordo, finalizado, completar) por UI', async ({ page }) => {
  const suffix = `${Date.now()}`;
  const driver = await registerVerifiedUser('lifecycle-dr');
  const passenger = await registerVerifiedUser('lifecycle-pa');

  // Seed: driver aprobado y vehiculo
  const adminSession = await loginSeedAdmin();
  await submitDriverApplication(driver.accessToken, suffix);
  await approveDriverApplication(adminSession.accessToken, driver.membershipId);
  const vehicleResponse = await registerVehicle(driver.accessToken, suffix);

  // Seed: viaje publicado
  const tripResponse = await createPublishedTrip(driver.accessToken, vehicleResponse.vehicle.id, suffix);
  const tripId = tripResponse.trip.id;

  // Seed: pasajero solicita y conductor acepta
  const requestResponse = await createTripRequest(passenger.accessToken, tripId, suffix);
  await acceptTripRequest(driver.accessToken, requestResponse.tripRequest.id);

  // Seed: iniciar viaje por API para saltarse validaciones de tiempo de forma robusta
  await startTrip(driver.accessToken, tripId);

  // Login como conductor
  await signInThroughUi(page, driver.email, driver.password);

  // Ir a una ruta de conductor para forzar que el modo de experiencia cambie a conductor
  await page.goto('/viajes/nuevo');
  await expect(page.getByRole('heading', { name: 'Nuevo viaje' })).toBeVisible();

  // Ir a mis viajes en modo conductor (ahora que el modo de experiencia ya es conductor)
  await page.goto('/viajes');

  // Buscar la tarjeta del viaje
  const tripCard = page
    .locator('article')
    .filter({
      has: page.getByRole('heading', {
        name: new RegExp(`Origen E2E ${suffix}.*Destino E2E ${suffix}`),
      }),
    })
    .first();
  await expect(tripCard).toBeVisible();

  // Verificar que el boton "Gestionar cierre" esta visible
  const closeManagementButton = tripCard.getByRole('button', { name: 'Gestionar cierre' });
  await expect(closeManagementButton).toBeVisible();
  await closeManagementButton.click();

  // Se abre el modal de finalizacion/cierre
  await expect(page.getByRole('heading', { name: `Origen E2E ${suffix} -> Destino E2E ${suffix}` })).toBeVisible();

  // El nombre del pasajero debe estar visible en el modal
  await expect(page.getByText(passenger.fullName)).toBeVisible();

  // Marcar abordo al pasajero
  const boardButton = page.getByRole('button', { name: 'Marcar abordo' });
  await expect(boardButton).toBeVisible();
  await boardButton.click();

  // Despues de marcar abordo, el boton "Marcar finalizado" debe aparecer
  const dropOffButton = page.getByRole('button', { name: 'Marcar finalizado' });
  await expect(dropOffButton).toBeVisible();
  await dropOffButton.click();

  // Ahora el viaje esta listo para ser completado, y el boton "Finalizar viaje" deberia estar habilitado
  const completeTripButton = page.getByRole('button', { name: 'Finalizar viaje' });
  await expect(completeTripButton).toBeVisible();
  await expect(completeTripButton).toBeEnabled();
  await completeTripButton.click();

  // El modal se cierra
  await expect(page.getByRole('heading', { name: `Origen E2E ${suffix} -> Destino E2E ${suffix}` })).toBeHidden();

  // El viaje cambia su estado a Finalizado y desaparece de la lista activa (se oculta)
  await expect(tripCard).toBeHidden();
});
