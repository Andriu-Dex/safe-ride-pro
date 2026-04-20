import { expect, test } from '@playwright/test';

import { loginSeedAdmin } from '../support/api';
import { openSidebarSection, signInThroughUi, waitForSectionHeading } from '../support/ui';

test('el admin puede iniciar sesion y acceder a auditoria', async ({ page }) => {
  await loginSeedAdmin();
  await signInThroughUi(page, 'admin@uta.edu.ec', 'Admin12345');

  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByText('Tu operacion de hoy en un vistazo.')).toBeVisible();

  await openSidebarSection(page, 'Auditoria');

  await expect(page).toHaveURL(/\/auditoria$/);
  await waitForSectionHeading(page, 'Auditoria institucional', 'Cargando auditoria');
  await expect(page.getByRole('heading', { name: 'Bandeja de reportes' })).toBeVisible();
});
