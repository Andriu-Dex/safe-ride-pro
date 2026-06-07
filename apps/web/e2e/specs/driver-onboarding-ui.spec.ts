import { expect, test } from '@playwright/test';
import { registerVerifiedUser } from '../support/api';
import { signInThroughUi, waitForSectionHeading } from '../support/ui';

test('un usuario verificado puede solicitar ser conductor y el admin lo aprueba por UI', async ({ browser }) => {
  test.setTimeout(180_000);

  const suffix = `${Date.now()}`;
  const driverUser = await registerVerifiedUser('drv-ui');

  const driverContext = await browser.newContext();
  const adminContext = await browser.newContext();

  const driverPage = await driverContext.newPage();
  const adminPage = await adminContext.newPage();

  try {
    // 1. Iniciar sesión como conductor y navegar a la solicitud de conductor
    await signInThroughUi(driverPage, driverUser.email, driverUser.password);
    await driverPage.goto('/conductor');
    await expect(driverPage).toHaveURL(/\/conductor$/);
    await waitForSectionHeading(driverPage, 'Tu estado operativo', 'Cargando estado de conductor');

    // Confirmar que el estado actual es "No solicitado"
    await expect(driverPage.getByText('No solicitado').first()).toBeVisible();

    // Iniciar la solicitud
    await driverPage.getByRole('button', { name: 'Crear solicitud' }).click();

    // Rellenar formulario
    await driverPage.getByLabel('Tipo de licencia').selectOption({ index: 1 });
    await driverPage.getByLabel('Fecha de expiracion').fill('2028-12-31');

    // Simular la subida de los documentos requeridos usando sus IDs directos
    const dummyIdentityFile = {
      name: 'cedula.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from([0]),
    };

    const dummyLicenseFile = {
      name: 'licencia.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from([0]),
    };

    await driverPage.locator('#driver-document-identity').setInputFiles(dummyIdentityFile);
    await driverPage.locator('#driver-document-license').setInputFiles(dummyLicenseFile);

    // Enviar solicitud
    await driverPage.getByRole('button', { name: 'Enviar solicitud' }).click();

    // Debería cambiar el estado a "Pendiente de revision"
    await expect(driverPage.getByText('Pendiente de revision').first()).toBeVisible();

    // 2. Administrador inicia sesión y aprueba la solicitud por UI
    await signInThroughUi(adminPage, 'admin@uta.edu.ec', 'Admin12345');
    await adminPage.goto('/moderacion');
    await waitForSectionHeading(adminPage, 'Centro de Moderación', 'Cargando moderacion');

    // Hacer clic en la pestaña "Conductores" si no está seleccionada por defecto
    await adminPage.getByRole('button', { name: /Conductores/ }).click();

    // Localizar la fila de la solicitud del conductor
    const driverRow = adminPage.locator('tr').filter({ hasText: driverUser.fullName }).first();
    await expect(driverRow).toBeVisible();

    // Hacer clic en Revisar
    await driverRow.getByRole('button', { name: 'Revisar' }).click();

    // Escribir nota administrativa y aprobar
    await adminPage.getByLabel('Nota administrativa').fill(`Aprobado por E2E UI ${suffix}`);
    await adminPage.getByRole('button', { name: 'Aprobar solicitud' }).click();

    // Validar en el panel de administración que el conductor ahora muestra estado "Aprobado"
    await expect(driverRow.getByText('Aprobado').first()).toBeVisible();

    // 3. Volver a la vista del conductor y verificar que se actualizó a "Aprobado"
    await driverPage.reload();
    await expect(driverPage.getByText('Aprobado').first()).toBeVisible();
  } finally {
    await Promise.allSettled([driverContext.close(), adminContext.close()]);
  }
});
