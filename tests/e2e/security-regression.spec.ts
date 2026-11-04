import { test, expect } from '@playwright/test';

if (process.env.BIOSFERA_E2E !== '1') throw new Error('Use o runner E2E isolado.');

test('consentimento hidrata cookie existente e reabre preferencias sem modificar escolhas', async ({ page, context }) => {
  const stored = { analytics: true, advertising: false };
  await context.addCookies([{ name: 'biosfera_cookie_consent', value: encodeURIComponent(JSON.stringify(stored)), domain: 'localhost', path: '/' }]);
  await page.goto('/');
  await expect(page.locator('.cookie-layer')).toHaveCount(0);
  await page.getByRole('button', { name: 'Preferências de cookies' }).click();
  await expect(page.locator('.cookie-layer')).toBeVisible();
  await expect(page.getByLabel('Permitir cookies de análise')).toBeChecked();
  await expect(page.getByLabel('Permitir cookies de publicidade')).not.toBeChecked();
  const cookie = (await context.cookies()).find(c => c.name === 'biosfera_cookie_consent');
  expect(JSON.parse(decodeURIComponent(cookie!.value))).toEqual(stored);
});

test('sem consentimento o aviso aparece e nenhuma opcao facultativa vem autorizada', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cookie-layer')).toBeVisible();
  await page.getByRole('button', { name: 'Personalizar', exact: true }).click();
  await expect(page.getByLabel('Permitir cookies de análise')).not.toBeChecked();
  await expect(page.getByLabel('Permitir cookies de publicidade')).not.toBeChecked();
});