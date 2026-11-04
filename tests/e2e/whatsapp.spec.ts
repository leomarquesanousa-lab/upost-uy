import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

if (process.env.BIOSFERA_E2E !== '1') throw new Error('Use npm run test:e2e.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(() => pool.end());
test.setTimeout(120000);

test('WhatsApp configurável: salvar, limpar, desktop/mobile e card de cookies', async ({ page, context }) => {
  const owner = (await pool.query("SELECT id FROM users WHERE role='OWNER' AND active LIMIT 1")).rows[0];
  const token = randomBytes(32).toString('hex');
  await pool.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')", [randomUUID(), owner.id, createHash('sha256').update(token).digest('hex')]);
  await context.addCookies([{ name: '__Host-biosfera_session', value: token, domain: 'localhost', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
  await page.goto('/');
  await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
  await page.goto('/admin/configuracoes');
  await page.getByLabel('Número do WhatsApp', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.locator('.admin-main [role="status"]')).toContainText('código do país');
  await page.getByLabel('Número do WhatsApp', { exact: true }).fill('+55 (11) 99999-9999');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.locator('.admin-main [role="status"]')).toContainText('salvas');
  expect((await pool.query("SELECT value FROM settings WHERE key='WHATSAPP_NUMBER'")).rows[0].value).toBe('5511999999999');
  await page.reload();
  await expect(page.getByLabel('Número do WhatsApp', { exact: true })).toHaveValue('5511999999999');
  await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
  await page.goto('/');
  const button = page.locator('a[href="https://wa.me/5511999999999"]');
  await expect(page.locator('.cookie-layer')).toBeVisible();
  await expect(button).toBeHidden();
  await page.getByRole('button', { name: 'Recusar', exact: true }).click();
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('target', '_blank');
  await expect(button).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(button).toHaveAccessibleName(/WhatsApp/);

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(button).toBeVisible();
    const box = (await button.boundingBox())!, player = (await page.locator('.radio-player').boundingBox())!;
    expect(box.y + box.height).toBeLessThan(player.y);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/whatsapp-${width}.png` });
    await page.getByRole('button', { name: 'Preferências de cookies' }).click();
    await expect(page.locator('.cookie-layer')).toBeVisible();
    await expect(button).toBeHidden();
    await page.screenshot({ path: `test-results/whatsapp-cookies-${width}.png` });
    await page.getByRole('button', { name: 'Só essenciais' }).click();
    await expect(button).toBeVisible();
    if (width < 760) {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      await expect(button).toBeHidden();
      await page.getByRole('button', { name: 'Fechar menu' }).click();
      await expect(button).toBeVisible();
    }
  }
  await page.goto('/admin/configuracoes');
  await page.getByLabel('Número do WhatsApp', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.locator('.admin-main [role="status"]')).toContainText('salvas');
  expect((await pool.query("SELECT value FROM settings WHERE key='WHATSAPP_NUMBER'")).rows[0].value).toBe('');
  await page.goto('/');
  await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
});
