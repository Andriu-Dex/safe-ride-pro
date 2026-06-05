import { expect, type Locator, type Page } from '@playwright/test';

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function signInThroughUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel(/Clave de acceso|Contrasena|Contraseña/i).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesion' }).click();
  await expect(page).toHaveURL(/\/(inicio|dashboard)$/);
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
}

export async function openSidebarSection(page: Page, label: string): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Principal' });
  const labelPattern = new RegExp(`^${escapeRegexLiteral(label)}$`, 'i');
  const groupedSectionByLabel: Record<string, string> = {
    Dashboard: 'Admin',
    Moderacion: 'Admin',
    Usuarios: 'Admin',
    Auditoria: 'Admin',
    Configuracion: 'Admin',
    Solicitudes: 'Conductor',
    Vehiculos: 'Conductor',
  };

  const groupLabel = groupedSectionByLabel[label];

  if (groupLabel) {
    const groupTrigger = nav.getByRole('button', {
      name: new RegExp(`^${escapeRegexLiteral(groupLabel)}$`, 'i'),
    });
    await groupTrigger.hover();
    await nav.getByRole('link', { name: labelPattern }).click();
    return;
  }

  const directLink = nav.getByRole('link', { name: labelPattern }).first();
  await directLink.click();
}

export async function waitForSectionHeading(
  page: Page,
  heading: string,
  loadingText?: string,
): Promise<void> {
  if (loadingText) {
    await page.getByText(loadingText).waitFor({ state: 'hidden' });
  }

  await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
}

export function listCardByText(page: Page, text: string): Locator {
  return page.locator('.list-card').filter({ hasText: text }).first();
}

export function strongCardByText(page: Page, text: string): Locator {
  return page.locator('.list-card-strong').filter({ hasText: text }).first();
}

export function createLocalDateTimeInput(offsetDays: number, offsetHours: number): string {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + offsetDays);
  targetDate.setHours(targetDate.getHours() + offsetHours, 0, 0, 0);

  const localDateTime = new Date(targetDate.getTime() - targetDate.getTimezoneOffset() * 60_000);
  return localDateTime.toISOString().slice(0, 16);
}
