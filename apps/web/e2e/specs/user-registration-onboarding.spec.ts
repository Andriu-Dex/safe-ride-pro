import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';

function buildDocumentNumber(seed: string): string {
  const digits = seed.replace(/\D/g, '').padStart(6, '0').slice(-6);
  const baseDigits = `171${digits}`;
  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const total = coefficients.reduce((sum, coefficient, index) => {
    let product = Number.parseInt(baseDigits.charAt(index), 10) * coefficient;
    if (product >= 10) {
      product -= 9;
    }
    return sum + product;
  }, 0);
  const verifierDigit = total % 10 === 0 ? 0 : 10 - (total % 10);
  return `${baseDigits}${verifierDigit}`;
}

function bruteForceVerificationCode(hash: string): string | null {
  for (let i = 0; i < 1_000_000; i++) {
    const candidate = i.toString().padStart(6, '0');
    const computedHash = crypto.createHash('sha256').update(candidate).digest('hex');
    if (computedHash === hash) {
      return candidate;
    }
  }
  return null;
}

function getVerificationCodeFromDb(email: string): string {
  const sql = `SELECT "tokenHash" FROM email_verification_codes evc JOIN users u ON evc."userId" = u.id WHERE u.email = '${email}' ORDER BY evc."createdAt" DESC LIMIT 1;`;
  const repoRoot = path.resolve(__dirname, '../../../..');
  const commandResult = spawnSync(
    'docker',
    [
      'compose',
      '--env-file',
      '.env.qa',
      '-f',
      'docker-compose.qa.yml',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'postgres',
      '-d',
      'safe_ride_pro_qa',
      '-t',
      '-A',
      '-c',
      sql,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: false,
    },
  );

  if (commandResult.status !== 0 || !commandResult.stdout) {
    throw new Error(`Failed to query tokenHash: ${commandResult.stderr}`);
  }

  const hash = commandResult.stdout.trim();
  if (!hash) {
    throw new Error(`No verification code found for email ${email}`);
  }

  const code = bruteForceVerificationCode(hash);
  if (!code) {
    throw new Error(`Failed to brute force verification code for hash: ${hash}`);
  }

  return code;
}

test('registro de usuario y completado de onboarding', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const email = `reg-e2e-${suffix}@uta.edu.ec`;
  const documentNumber = buildDocumentNumber(suffix);

  await page.goto('/register');
  await page.getByLabel('Nombre completo').fill(`Usuario Registro ${suffix}`);
  await page.getByLabel('Correo institucional').fill(email);
  await page.getByLabel('Tipo de documento').selectOption('NATIONAL_ID');
  await page.getByLabel('Número de documento').fill(documentNumber);
  await page.getByLabel('Teléfono (opcional)').fill('0999999999');
  await page.getByLabel('Clave de acceso', { exact: true }).fill('UserPass123!');
  await page.getByLabel('Confirmar clave', { exact: true }).fill('UserPass123!');

  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  // Debería redirigir a /verify-email
  await expect(page).toHaveURL(/\/verify-email/);

  // Obtener el código de verificación de la base de datos
  const code = getVerificationCodeFromDb(email);

  const verifyCodeInput = page.getByLabel('Código de verificación');
  await verifyCodeInput.fill(code);

  // Clic en "Verificar correo"
  await page.getByRole('button', { name: 'Verificar correo' }).click();

  // Debería redirigir a /perfil debido a requiere onboarding
  await expect(page).toHaveURL(/\/perfil/);

  // Verificar que la página del perfil indica "Onboarding pendiente"
  await expect(page.getByText('Onboarding pendiente')).toBeVisible();

  // Hacemos clic en "Completar perfil"
  await page.getByRole('button', { name: 'Completar perfil' }).click();

  // Rellenar campos del modal
  await page.getByLabel('Carrera').fill('Ingenieria en Software');
  await page.getByLabel('Celular').fill('0987654321');
  await page.getByLabel('Zona o barrio de referencia').fill('Ficoa');

  // Hacemos clic en "Aceptar todo" para los consentimientos
  await page.getByRole('button', { name: 'Aceptar todo' }).click();

  // Enviar el formulario haciendo clic en el botón con texto "Completar perfil" dentro del modal
  await page.locator('form').getByRole('button', { name: 'Completar perfil' }).click();

  // Debería cerrar el modal, guardar y redirigir a /inicio
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('heading', { name: /Hola, Usuario/ })).toBeVisible();

  // Si volvemos a /perfil, el estado debería mostrar "Perfil completo"
  await page.goto('/perfil');
  await expect(page.getByText('Perfil completo')).toBeVisible();
});
