import { expect, type Locator, type Page } from '@playwright/test';

export async function signInThroughUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contrasena').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesion' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Resumen operativo' })).toBeVisible();
}

export async function openSidebarSection(page: Page, label: string): Promise<void> {
  await page.locator('.app-sidebar').getByRole('link', { name: new RegExp(label, 'i') }).click();
}

export async function waitForSectionHeading(
  page: Page,
  heading: string,
  loadingText?: string,
): Promise<void> {
  if (loadingText) {
    await page.getByText(loadingText).waitFor({ state: 'hidden' });
  }

  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
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
