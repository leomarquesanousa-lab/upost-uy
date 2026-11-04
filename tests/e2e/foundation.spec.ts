import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
if (process.env.BIOSFERA_E2E !== '1') throw new Error('Execute npm run test:e2e para utilizar um banco isolado.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(async () => { await pool.end(); });
test('migrations e bootstrap são idempotentes', async () => {
  expect((await pool.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count).toBe(8);
  expect((await pool.query("SELECT count(*)::int AS count FROM users WHERE role='OWNER'")).rows[0].count).toBe(1);
});
test('login, sessão protegida, expiração, inativação e logout', async ({ page, context }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel('E-mail', { exact: true }).fill(process.env.ADMIN_INITIAL_OWNER_EMAIL!);
  await page.getByLabel('Senha', { exact: true }).fill('senha-incorreta');
  await page.getByRole('button', { name: 'Entrar no painel' }).click();
  await expect(page.locator('.form-error')).toContainText('E-mail ou senha inválidos');
  await page.getByLabel('E-mail', { exact: true }).fill(process.env.ADMIN_INITIAL_OWNER_EMAIL!);
  await page.getByLabel('Senha', { exact: true }).fill(process.env.ADMIN_INITIAL_OWNER_PASSWORD!);
  await page.getByRole('button', { name: 'Entrar no painel' }).click();
  await expect(page.getByRole('heading', { name: 'Olá, Owner de teste.' })).toBeVisible();
  const cookie = (await context.cookies()).find(c => c.name.includes('biosfera_session'))!;
  expect(Boolean(cookie?.httpOnly && cookie.secure && cookie.sameSite === 'Lax')).toBe(true);
  const record = (await pool.query('SELECT token_hash FROM sessions LIMIT 1')).rows[0];
  expect(Boolean(record && record.token_hash !== cookie.value && record.token_hash.length === 64)).toBe(true);
  expect((await pool.query('SELECT last_login_at IS NOT NULL AS ok FROM users')).rows[0].ok).toBe(true);
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await pool.query('SELECT count(*)::int AS count FROM sessions')).rows[0].count).toBe(0);
  await context.addCookies([cookie]);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  const signIn = async () => {
    await page.getByLabel('E-mail', { exact: true }).fill(process.env.ADMIN_INITIAL_OWNER_EMAIL!);
    await page.getByLabel('Senha', { exact: true }).fill(process.env.ADMIN_INITIAL_OWNER_PASSWORD!);
    await page.getByRole('button', { name: 'Entrar no painel' }).click();
  };
  await signIn();
  await expect(page).toHaveURL(/\/admin$/);
  await pool.query("UPDATE sessions SET expires_at=now()-interval '1 second'");
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await signIn();
  await expect(page).toHaveURL(/\/admin$/);
  await pool.query('UPDATE users SET active=false');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await signIn();
  await expect(page.locator('.form-error')).toContainText('E-mail ou senha inválidos');
  await pool.query('UPDATE users SET active=true');
  expect((await pool.query("SELECT count(*)::int AS count FROM audit_log WHERE action='auth.logout'")).rows[0].count).toBe(1);
});
test('limita tentativas e rejeita origem externa', async ({ page, request }) => {
  await page.goto('/admin/login');
  await page.getByLabel('E-mail', { exact: true }).fill('invalid@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('incorreta');
  for (let i=0; i<6; i++) {
    await page.getByLabel('E-mail', { exact: true }).fill('invalid@example.test');
    await page.getByLabel('Senha', { exact: true }).fill('incorreta');
    await page.getByRole('button', { name: 'Entrar no painel' }).click();
    await expect(page.getByRole('button', { name: 'Entrar no painel' })).toBeEnabled();
    await expect(page.locator('.form-error')).toContainText(i < 5 ? 'E-mail ou senha inválidos' : 'Muitas tentativas');
  }
  const response = await request.post('/admin/login', { headers: { origin: 'https://external.invalid', 'next-action': 'invalid' } });
  expect(response.ok()).toBe(false);
});
test('player preserva elemento e reprodução na navegação, layout mobile', async ({ page }) => {
  // WAV local silencioso: testa reprodução real sem depender do serviço externo.
  const bytes = Buffer.alloc(44 + 8000 * 2 * 60);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length-8,4); bytes.write('WAVEfmt ',8); bytes.writeUInt32LE(16,16); bytes.writeUInt16LE(1,20); bytes.writeUInt16LE(1,22); bytes.writeUInt32LE(8000,24); bytes.writeUInt32LE(16000,28); bytes.writeUInt16LE(2,32); bytes.writeUInt16LE(16,34); bytes.write('data',36); bytes.writeUInt32LE(bytes.length-44,40);
  await page.route('https://s1.dvr.ovh:6696/stream', route => route.fulfill({ contentType: 'audio/wav', body: bytes }));
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('audio')).toHaveCount(1);
  const audio = await page.locator('audio').elementHandle();
  await page.getByRole('button', { name: 'Ouvir rádio' }).click();
  await expect(page.getByRole('status')).toContainText('Você está ouvindo');
  await page.getByRole('link', { name: 'Notícias', exact: true }).click();
  await expect(page).toHaveURL(/\/noticias$/);
  expect(await audio!.evaluate(el => el === document.querySelector('audio') && !(el as HTMLAudioElement).paused)).toBe(true);
  await page.getByRole('button', { name: 'Pausar rádio' }).click();
  await expect(page.getByRole('status')).toContainText('Pronta');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('rádio limita reconexões e permite nova tentativa manual', async ({ page }) => {
  let attempts = 0;
  await page.route('https://s1.dvr.ovh:6696/stream', route => { attempts++; return route.abort('failed'); });
  await page.goto('/');
  await page.clock.install();
  await page.getByRole('button', { name: 'Ouvir rádio' }).click();
  await expect.poll(() => attempts).toBe(1);
  for (const [index, delay] of [2100, 4100, 8100].entries()) {
    await page.clock.fastForward(delay);
    await expect.poll(() => attempts).toBe(index + 2);
  }
  await expect(page.getByRole('status')).toContainText('Não foi possível conectar');
  await page.clock.fastForward(60000);
  expect(attempts).toBe(4);
  await page.getByRole('button', { name: 'Ouvir rádio' }).click();
  await expect.poll(() => attempts).toBe(5);
  await page.getByRole('button', { name: 'Pausar rádio' }).click();
  await page.clock.fastForward(60000);
  expect(attempts).toBe(5);
});
