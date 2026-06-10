import { expect, test } from '@playwright/test';
import { registerVerifiedUser } from '../support/api';
import { signInThroughUi, openSidebarSection } from '../support/ui';

test('un administrador puede buscar y ver un usuario en el directorio de usuarios', async ({
  page,
}) => {
  // Seed un usuario verificado para buscar
  const user = await registerVerifiedUser('usr-dir');

  // Login como Admin
  await signInThroughUi(page, 'admin@uta.edu.ec', 'Admin12345');

  // Navegar a Usuarios vía Sidebar
  await openSidebarSection(page, 'Usuarios');
  await expect(page).toHaveURL(/\/usuarios/);

  // Verificar encabezado
  await expect(page.getByRole('heading', { level: 1, name: 'Gestión de Usuarios' })).toBeVisible();

  // Buscar el usuario por su nombre completo
  const searchInput = page.getByLabel('Buscar');
  await expect(searchInput).toBeVisible();
  await searchInput.fill(user.fullName);

  // Aplicar filtros
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();

  // Verificar que el usuario aparece en la tabla
  const userRow = page.locator('tr').filter({ hasText: user.fullName });
  await expect(userRow).toBeVisible();

  // Y verificar su correo en la misma fila
  await expect(userRow.getByText(user.email)).toBeVisible();
});
