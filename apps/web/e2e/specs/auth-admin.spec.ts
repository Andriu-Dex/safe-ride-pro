import { expect, test } from '@playwright/test';

import { loginSeedAdmin } from '../support/api';
import { openSidebarSection, signInThroughUi, waitForSectionHeading } from '../support/ui';

test('el admin puede iniciar sesion y acceder a auditoria', async ({ page }) => {
  await loginSeedAdmin();
  await signInThroughUi(page, 'admin@uta.edu.ec', 'Admin12345');

  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('heading', { name: /Hola,/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alcance administrativo' })).toBeVisible();

  await openSidebarSection(page, 'Auditoria');

  await expect(page).toHaveURL(/\/auditoria$/);
  await waitForSectionHeading(page, 'Trazabilidad Institucional', 'Cargando auditoria');
  await expect(page.getByLabel('Acción')).toBeVisible();

  await openSidebarSection(page, 'Moderacion');
  await expect(page).toHaveURL(/\/moderacion$/);
  await waitForSectionHeading(page, 'Centro de Moderación', 'Cargando moderacion');
  await expect(page.getByRole('button', { name: /Conductores/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reportes/ })).toBeVisible();
});
