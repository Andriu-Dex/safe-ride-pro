import { expect, test } from '@playwright/test';
import { signInThroughUi, openSidebarSection } from '../support/ui';

test('un administrador puede modificar las configuraciones institucionales y verlas reflejadas', async ({
  page,
}) => {
  const suffix = `${Date.now()}`;
  const uniqueTitle = `Reglas de Seguridad E2E ${suffix}`;

  // Login como Admin
  await signInThroughUi(page, 'admin@uta.edu.ec', 'Admin12345');

  // Navegar a Configuración vía Sidebar
  await openSidebarSection(page, 'Configuracion');
  await expect(page).toHaveURL(/\/configuracion/);

  // Verificar encabezado
  await expect(page.getByRole('heading', { level: 1, name: 'Configuración General' })).toBeVisible();

  // Modificar el título de las reglas de seguridad
  const titleInput = page.getByLabel('Título de las reglas');
  await expect(titleInput).toBeVisible();
  await titleInput.fill(uniqueTitle);

  // Hacer click en "Guardar Cambios"
  await page.getByRole('button', { name: 'Guardar Cambios' }).click();

  // Verificar que muestra el mensaje toast de éxito
  await expect(page.getByText('Configuracion guardada')).toBeVisible();

  // Recargar la página
  await page.reload();

  // Verificar persistencia del cambio
  await expect(page.getByLabel('Título de las reglas')).toHaveValue(uniqueTitle);
});
