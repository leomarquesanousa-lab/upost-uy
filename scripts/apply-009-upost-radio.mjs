import './env.mjs';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { rootCertificates } from 'node:tls';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { Pool } from 'pg';
import { databaseIdentity } from '../lib/editorial/initial-import.mjs';
const manifest = JSON.parse(await readFile('scripts/initial-news.json', 'utf8'));
if (process.env.SITE_NAME !== 'UPOST.uy' || databaseIdentity(process.env.DATABASE_URL || '').fingerprint !== manifest.databaseFingerprint) throw Error('Identidade do Neon UPOST divergente.');
const name = '009_portal_resources.sql';
const sql = await readFile('database/migrations/' + name, 'utf8');
const checksum = createHash('sha256').update(sql).digest('hex');
if (/\b(DROP|TRUNCATE|DELETE|ALTER)\s/i.test(sql)) throw Error('A migração exige nova revisão: operação potencialmente destrutiva.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
async function run(command, args, env = process.env) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const timeout = setTimeout(() => child.kill(), 180000);
    let error = ''; child.stderr.on('data', chunk => error += chunk);
    child.stdout.resume(); child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('exit', code => { clearTimeout(timeout); if (code === 0) resolve(); else reject(Error('Backup/verificação falhou: ' + error.slice(0, 300))); });
  });
}
try {
  await client.query('SELECT pg_advisory_lock(84201901)');
  const migrations = (await client.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows;
  for (const migration of migrations) {
    const current = createHash('sha256').update(await readFile('database/migrations/' + migration.name, 'utf8')).digest('hex');
    if (current !== migration.checksum) throw Error('Checksum divergente na migração já aplicada: ' + migration.name);
  }
  if (migrations.some(row => row.name === name)) console.log(JSON.stringify({ alreadyApplied: true, migration: name }));
  else {
    const objects = (await client.query("SELECT to_regclass('public.portal_resources') AS resources,to_regclass('public.portal_resources_public') AS resource_index,to_regclass('public.news_search_es_idx') AS search_index")).rows[0];
    if (Object.values(objects).some(Boolean)) throw Error('Objetos da 009 já existem sem registro: revisar antes de continuar.');
    await client.query('SELECT title,subtitle,excerpt FROM news LIMIT 0');
    await client.query('SELECT code,active FROM ad_slots LIMIT 0');
    console.log(JSON.stringify({ target: 'Neon UPOST.uy', migration: name, compatible: true, destructiveOperations: false, previouslyApplied: migrations.length }));
    if (!process.argv.includes('--commit')) { console.log('Dry-run: nenhuma migração executada.'); }
    else {
      const folder = path.resolve('storage/backups'); await mkdir(folder, { recursive: true });
      const ca = path.join(folder, 'postgres-ca.pem'); await writeFile(ca, rootCertificates.join('\n'));
      const backup = path.join(folder, 'upost-before-009-' + new Date().toISOString().replace(/[:.]/g, '-') + '.dump');
      const connection = new URL(process.env.DATABASE_URL);
      const env = { ...process.env, PGHOST: connection.hostname, PGPORT: connection.port || '5432', PGDATABASE: decodeURIComponent(connection.pathname.slice(1)), PGUSER: decodeURIComponent(connection.username), PGPASSWORD: decodeURIComponent(connection.password), PGSSLMODE: 'verify-full', PGSSLROOTCERT: ca, PGCONNECT_TIMEOUT: '15' };
      await run('C:/Program Files/PostgreSQL/18/bin/pg_dump.exe', ['--no-password', '--format=custom', '--no-owner', '--no-acl', '--file', backup], env);
      await run('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe', ['--list', backup]);
      if ((await stat(backup)).size < 1000) throw Error('Backup inesperadamente pequeno.');
      console.log(JSON.stringify({ backup, bytes: (await stat(backup)).size, archiveVerified: true }));
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      await client.query("SET LOCAL lock_timeout='5s'"); await client.query("SET LOCAL statement_timeout='60s'");
      const slots = (await client.query('SELECT * FROM ad_slots ORDER BY id')).rows;
      const campaigns = (await client.query('SELECT * FROM ad_campaigns ORDER BY id')).rows;
      const news = (await client.query('SELECT count(*)::int AS count FROM news')).rows[0].count;
      await client.query(sql);
      if (JSON.stringify((await client.query('SELECT * FROM ad_slots WHERE id=ANY($1::uuid[]) ORDER BY id', [slots.map(row => row.id)])).rows) !== JSON.stringify(slots)) throw Error('Posições existentes foram alteradas.');
      if (JSON.stringify((await client.query('SELECT * FROM ad_campaigns ORDER BY id')).rows) !== JSON.stringify(campaigns)) throw Error('Campanhas existentes foram alteradas.');
      if ((await client.query('SELECT count(*)::int AS count FROM news')).rows[0].count !== news) throw Error('Contagem de notícias divergente.');
      await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
      await client.query('COMMIT');
      const report = { applied: name, checksum, backup, existingSlotsPreserved: slots.length, campaignsPreserved: campaigns.length, newsPreserved: news, appliedOnce: true };
      await writeFile('test-results/radio-migration-result.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
    }
  }
} catch (error) { await client.query('ROLLBACK').catch(() => {}); console.error(error.message); process.exitCode = 1; }
finally { await client.query('SELECT pg_advisory_unlock(84201901)').catch(() => {}); client.release(); await pool.end(); }
