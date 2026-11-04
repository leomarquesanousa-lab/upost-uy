import './env.mjs';
import { Pool } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
if (!process.env.DATABASE_URL) { console.error('Configure DATABASE_URL em .env.local.'); process.exit(1); }
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
let client;
try {
  client = await pool.connect();
  await client.query('SELECT pg_advisory_lock(84201901)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, executed_at timestamptz NOT NULL DEFAULT now())');
  const files = (await readdir('database/migrations')).filter(f => /^\d+_[a-z0-9_]+\.sql$/.test(f)).sort();
  for (const name of files) {
    const sql = await readFile(`database/migrations/${name}`, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const previous = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name]);
    if (previous.rowCount) {
      if (previous.rows[0].checksum !== checksum) throw new Error('Migration alterada após aplicação.');
      console.log(`Já aplicada: ${name}`); continue;
    }
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
    await client.query('COMMIT');
    console.log(`Aplicada: ${name}`);
  }
} catch {
  if (client) await client.query('ROLLBACK').catch(() => {});
  console.error('Migration falhou. Confira conexão, permissões e integridade dos arquivos SQL.'); process.exitCode = 1;
} finally {
  if (client) { await client.query('SELECT pg_advisory_unlock(84201901)').catch(() => {}); client.release(); }
  await pool.end();
}
