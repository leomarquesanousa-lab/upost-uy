import './env.mjs';
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
if (existsSync('.env.test.local')) process.loadEnvFile('.env.test.local');
// Sempre cria e remove uma base exclusiva, somente em PostgreSQL local.
const testUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const source = new URL(testUrl || 'postgresql://localhost/missing');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(source.hostname) || !testUrl) {
  console.error('Teste E2E exige TEST_DATABASE_URL de PostgreSQL local. O banco remoto não será utilizado.'); process.exit(1);
}
const database = `biosfera_test_${randomBytes(6).toString('hex')}`;
const adminUrl = new URL(source); adminUrl.pathname = '/postgres';
const pool = new Pool({ connectionString: adminUrl.href });
source.pathname = `/${database}`;
const env = { ...process.env, DATABASE_URL: source.href, SITE_URL: 'http://localhost:3100', UPLOAD_DIR: `test-results/uploads-${database}`, ADMIN_INITIAL_OWNER_NAME: 'Owner de teste', ADMIN_INITIAL_OWNER_EMAIL: 'owner@example.test', ADMIN_INITIAL_OWNER_PASSWORD: randomBytes(24).toString('hex'), BIOSFERA_E2E: '1' };
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error('Teste falhou.')));
  });
}
try {
  await pool.query(`CREATE DATABASE ${database}`);
  await run(['scripts/migrate.mjs']);
  await run(['scripts/migrate.mjs']);
  await run(['scripts/bootstrap-owner.mjs']);
  await run(['scripts/bootstrap-owner.mjs']);
  await run(['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)]);
} catch { console.error('Validação E2E falhou; veja o resultado dos testes.'); process.exitCode = 1; }
finally { await pool.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`).catch(() => {}); await pool.end(); }
