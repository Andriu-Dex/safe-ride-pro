import { expect, test } from '@playwright/test';
import { registerVerifiedUser } from '../support/api';
import { signInThroughUi } from '../support/ui';

test('un usuario puede acceder a la billetera, ver su saldo y el formulario de recarga', async ({
  page,
}) => {
  const user = await registerVerifiedUser('wallet-usr');

  // Sign in
  await signInThroughUi(page, user.email, user.password);

  // Navegar a la billetera
  await page.goto('/billetera');

  // Verificar encabezado
  await expect(page.getByRole('heading', { name: 'Saldo SafeRidePro' })).toBeVisible();

  // Verificar secciones de saldo
  await expect(page.getByText('Disponible', { exact: true })).toBeVisible();
  await expect(page.getByText('Retenido', { exact: true })).toBeVisible();

  // Verificar formulario de recarga por PayPal
  await expect(page.getByRole('heading', { name: 'PayPal' })).toBeVisible();
  await expect(page.getByLabel('Monto')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recargar' })).toBeVisible();

  // Verificar las secciones de movimientos y recargas
  await expect(page.getByRole('heading', { name: 'Movimientos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recargas' })).toBeVisible();
});
