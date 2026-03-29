import { expect, test } from '@playwright/test';

import { openSidebarSection, signInThroughUi } from '../support/ui';

test('el admin puede iniciar sesion y acceder a auditoria', async ({ page }) => {
  await signInThroughUi(page, 'admin@uta.edu.ec', 'Admin12345');

  await expect(page.getByText('Sesion protegida')).toBeVisible();
  await expect(page.getByText('API conectada')).toBeVisible();

  await openSidebarSection(page, 'Auditoria');

  await expect(page).toHaveURL(/\/auditoria$/);
  await expect(page.getByRole('heading', { name: 'Auditoria' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bandeja de reportes' })).toBeVisible();
});
