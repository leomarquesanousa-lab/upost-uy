import { test, expect, type BrowserContext } from '@playwright/test';
import { Pool } from 'pg';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { hashPassword } from '../../lib/security/password.mjs';

if (process.env.BIOSFERA_E2E !== '1') throw new Error('Use npm run test:e2e.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(() => pool.end());
test.setTimeout(120000);

async function auth(context: BrowserContext, id: string) {
  const token = randomBytes(32).toString('hex');
  await pool.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')", [randomUUID(), id, createHash('sha256').update(token).digest('hex')]);
  await context.addCookies([{ name: '__Host-biosfera_session', value: token, domain: 'localhost', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
}

test('painel: ações da tabela, exclusão lógica, auditoria e integrações por perfil', async ({ page, context, browser }) => {
  const owner = (await pool.query("SELECT id FROM users WHERE role='OWNER' AND active AND deleted_at IS NULL")).rows[0].id;
  const admin = randomUUID(), editor = randomUUID();
  const hash = await hashPassword('Senha de teste isolado 123!');
  for (const [id, role] of [[admin, 'ADMIN'], [editor, 'EDITOR']]) {
    await pool.query('INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)', [id, `Validação ${role}`, `${id}@example.test`, hash, role]);
  }
  await auth(context, owner);
  await page.goto('/admin');
  await expect(page.locator('.admin-main')).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-owner-dashboard.png', fullPage: true });
  await page.goto('/admin/usuarios');
  await expect(page.getByRole('link', { name: '+ Novo usuário', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Proprietário', exact: true })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: `${editor}@example.test` });
  await expect(row.getByRole('cell', { name: 'Operador', exact: true })).toBeVisible();
  const ec = await browser.newContext();
  await auth(ec, editor);
  await row.locator('summary').click();
  await row.getByRole('button', { name: 'Desativar', exact: true }).click();
  await expect(row.getByRole('cell', { name: 'Inativo', exact: true })).toBeVisible();
  expect((await pool.query('SELECT id FROM sessions WHERE user_id=$1', [editor])).rowCount).toBe(0);
  await row.getByRole('button', { name: 'Ativar', exact: true }).click();
  await expect(row.getByRole('cell', { name: 'Ativo', exact: true })).toBeVisible();
  await row.getByRole('link', { name: 'Redefinir senha', exact: true }).click();
  await expect(page.getByLabel('Nova senha', { exact: true })).toBeVisible();
  await auth(ec, editor);
  await page.getByLabel('Papel', { exact: true }).selectOption('ADMIN');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/usuarios$/);
  expect((await pool.query('SELECT id FROM sessions WHERE user_id=$1', [editor])).rowCount).toBe(0);
  await page.goto(`/admin/usuarios/${editor}`);
  await page.getByLabel('Papel', { exact: true }).selectOption('EDITOR');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/usuarios$/);
  await page.screenshot({ path: 'test-results/admin-owner-users.png', fullPage: true });

  await page.goto('/admin/integracoes');
  await expect(page.getByRole('heading', { name: 'Integrações', exact: true })).toBeVisible();
  await page.getByLabel('ID de medição', { exact: true }).fill('');
  await page.getByLabel('Publisher ID', { exact: true }).fill('');
  await page.getByLabel('Analytics ativo', { exact: true }).check();
  await page.getByLabel('AdSense ativo', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Salvar integrações' }).click();
  await expect(page.locator('.admin-main [role="status"]')).toContainText('ID válido');
  await page.getByLabel('Analytics ativo', { exact: true }).uncheck();
  await page.getByLabel('AdSense ativo', { exact: true }).check();
  await page.getByRole('button', { name: 'Salvar integrações' }).click();
  await expect(page.locator('.admin-main [role="status"]')).toContainText('Publisher ID válido');
  await page.getByLabel('AdSense ativo', { exact: true }).uncheck();
  const requestPromise = page.waitForRequest(r => r.method() === 'POST' && Boolean(r.headers()['next-action']));
  await page.getByRole('button', { name: 'Salvar integrações' }).click();
  const savedRequest = await requestPromise;
  await expect(page.locator('.admin-main [role="status"]')).toContainText('Integrações salvas');
  await page.reload();
  await expect(page.getByLabel('Analytics ativo', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('AdSense ativo', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('ID de medição', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Publisher ID', { exact: true })).toHaveValue('');
  await page.screenshot({ path: 'test-results/admin-owner-integrations.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/admin-integrations-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  const auditCount = (await pool.query("SELECT count(*) FROM audit_log WHERE action='integrations.updated'")).rows[0].count;
  for (const [id, role] of [[admin, 'ADMIN'], [editor, 'EDITOR']]) {
    const restricted = await browser.newContext();
    await auth(restricted, id);
    const p = await restricted.newPage();
    await p.goto('/admin');
    await expect(p.locator('.admin-main')).toBeVisible();
    await p.screenshot({ path: `test-results/admin-${role}-dashboard.png`, fullPage: true });
    for (const route of ['/admin/integracoes', '/admin/configuracoes']) {
      await p.goto(route);
      await expect(p).toHaveURL(/\/admin$/);
    }
    await p.goto('/admin/usuarios');
    await expect(p).toHaveURL(role === 'ADMIN' ? /\/admin\/usuarios$/ : /\/admin$/);
    if (role === 'ADMIN') {
      await expect(p.getByRole('row').filter({ hasText: 'Proprietário' })).toContainText('Protegido');
      await p.screenshot({ path: 'test-results/admin-ADMIN-users.png', fullPage: true });
    }
    // Replay an actual owner Server Action with a lower-privilege session.
    const headers: Record<string, string> = { ...await savedRequest.allHeaders(), origin: new URL(savedRequest.url()).origin };
    delete headers.cookie;
    delete headers['content-length'];
    const response = await restricted.request.post(savedRequest.url(), { headers, data: savedRequest.postDataBuffer()! });
    expect(await response.text()).toContain('permissão');
    expect((await pool.query("SELECT count(*) FROM audit_log WHERE action='integrations.updated'")).rows[0].count).toBe(auditCount);
    await restricted.close();
  }
  await page.goto('/');
  await expect(page.locator('script[src*="googletagmanager.com"],script[src*="adsbygoogle.js"]')).toHaveCount(0);
  await page.goto('/admin/usuarios');
  await row.locator('summary').click();
  await auth(ec, editor);
  page.once('dialog', dialog => dialog.accept());
  await row.getByRole('button', { name: 'Excluir usuário' }).click();
  await expect(row).toHaveCount(0);
  const deleted = (await pool.query('SELECT active,deleted_at FROM users WHERE id=$1', [editor])).rows[0];
  expect(deleted.active).toBe(false);
  expect(deleted.deleted_at).not.toBeNull();
  expect((await pool.query('SELECT id FROM sessions WHERE user_id=$1', [editor])).rowCount).toBe(0);
  const events = (await pool.query('SELECT action FROM audit_log WHERE entity_id=$1', [editor])).rows.map(r => r.action);
  expect(events).toEqual(expect.arrayContaining(['users.updated', 'users.role_changed', 'users.activated', 'users.deactivated', 'users.deleted']));
  await ec.close();
});
