import './env.mjs';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { databaseIdentity } from '../lib/editorial/initial-import.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: new URL('../node_modules/next/dist/compiled/server-only/empty.js', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('@/') || (specifier.startsWith('.') && context.parentURL?.startsWith(new URL('../', import.meta.url).href) && !context.parentURL.includes('/node_modules/'))) {
    const base = specifier.startsWith('@/') ? new URL('../' + specifier.slice(2), import.meta.url) : new URL(specifier, context.parentURL);
    for (const suffix of ['', '.ts', '.mjs']) { const url = new URL(base.href + suffix); if (existsSync(url)) return next(url.href, context); }
  }
  return next(specifier, context);
} });
let pool;
try {
  const manifest = JSON.parse(await readFile(path.join(root, 'scripts/initial-news.json'), 'utf8'));
  const identity = databaseIdentity(process.env.DATABASE_URL || '');
  if (path.resolve(process.cwd()).toLowerCase() !== path.resolve(root).toLowerCase() || process.env.SITE_NAME !== 'UPOST.uy' || identity.fingerprint !== manifest.databaseFingerprint) throw Error('Identidade do UPOST / Neon divergente.');
  const { getPool } = await import('../lib/db/pool.ts');
  const { topAdSlots, createTopAdSlot } = await import('../server/services/ads.ts');
  pool = getPool();
  const before = await pool.query('SELECT code FROM ad_slots WHERE code=ANY($1::text[])', [topAdSlots.map(s => s.code)]);
  const missing = topAdSlots.filter(s => !before.rows.some(row => row.code === s.code));
  const commit = process.argv.includes('--commit');
  console.log(JSON.stringify({ target: 'UPOST.uy / Neon', mode: commit ? 'commit' : 'dry-run', missing: missing.map(s => s.code) }));
  if (commit && missing.length) {
    const owner = (await pool.query("SELECT id FROM users WHERE role='OWNER' AND active AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1")).rows[0]?.id;
    if (!owner) throw Error('OWNER ativo não encontrado para o registro de auditoria.');
    for (const slot of missing) { const form = new FormData(); form.set('code', slot.code); await createTopAdSlot(form, owner); }
  }
  console.log(JSON.stringify((await pool.query('SELECT s.code,s.active,count(c.id)::int AS campaigns FROM ad_slots s LEFT JOIN ad_campaigns c ON c.slot_id=s.id WHERE s.code=ANY($1::text[]) GROUP BY s.code,s.active ORDER BY s.code', [topAdSlots.map(s => s.code)])).rows));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await pool?.end(); }
