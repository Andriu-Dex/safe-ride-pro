import { expect, test } from '@playwright/test';
import {
  getResetCodeFromDb,
  registerVerifiedUser,
  requestPasswordReset,
} from '../support/api';
import { signInThroughUi } from '../support/ui';

test('un usuario puede recuperar su contrasena y acceder con la nueva clave', async ({ page }) => {
  const user = await registerVerifiedUser('reset-pw');
  const newPassword = 'NuevaClave456!';

  // 1. Solicitar reset via API (seed la precondición del código)
  await requestPasswordReset(user.email);

  // 2. Extraer código de la base de datos
  const resetCode = getResetCodeFromDb(user.email);

  // 3. Navegar a /reset-password e ingresar el código y la nueva contraseña por UI
  await page.goto(`/reset-password?email=${encodeURIComponent(user.email)}&sent=1`);
  await page.getByLabel('Código de recuperación').fill(resetCode);
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Actualizar contraseña' }).click();

  // 4. Debería mostrar el mensaje de éxito y redirigir a login
  await expect(page.getByText('Contraseña actualizada')).toBeVisible();
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

  // 5. Iniciar sesión con la nueva contraseña
  await signInThroughUi(page, user.email, newPassword);
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('heading', { name: /Hola,/ })).toBeVisible();
});
