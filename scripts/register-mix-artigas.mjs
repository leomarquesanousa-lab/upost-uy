import './env.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { databaseIdentity } from '../lib/editorial/initial-import.mjs';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: new URL('../node_modules/next/dist/compiled/server-only/empty.js', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('@/') || (specifier.startsWith('.') && context.parentURL?.startsWith(new URL('../', import.meta.url).href) && !context.parentURL.includes('/node_modules/'))) {
    const base = specifier.startsWith('@/') ? new URL('../' + specifier.slice(2), import.meta.url) : new URL(specifier, context.parentURL);
    for (const suffix of ['', '.ts', '.mjs']) { const url = new URL(base.href + suffix); if (existsSync(url)) return next(url.href, context); }
  }
  return next(specifier, context);
} });
const manifest = JSON.parse(await readFile('scripts/initial-news.json', 'utf8'));
if (process.env.SITE_NAME !== 'UPOST.uy' || databaseIdentity(process.env.DATABASE_URL || '').fingerprint !== manifest.databaseFingerprint) throw Error('Banco UPOST divergente.');
const website = 'https://www.radiomixartigas.com/';
const stream = 'https://radio.bachistreaming.com/radio-mix-artigas';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const config = await fetch(website + 'config.js', { signal: AbortSignal.timeout(10000) });
  if (!config.ok || !(await config.text()).includes(stream)) throw Error('O site oficial não confirma mais o endereço do streaming.');
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
  let verification;
  try {
    const response = await fetch(stream, { headers: { 'Icy-MetaData': '1' }, signal: controller.signal });
    const name = response.headers.get('icy-name'), mime = response.headers.get('content-type');
    if (!response.ok || !mime?.startsWith('audio/') || name !== 'Radio Mix Artigas') throw Error('Resposta de áudio ou identificação da rádio divergente.');
    const reader = response.body.getReader(); const chunk = await reader.read(); await reader.cancel();
    if (!chunk.value?.length) throw Error('Streaming não entregou áudio.');
    verification = { status: response.status, mime, station: name, bytesReceived: chunk.value.length, bitrate: response.headers.get('icy-br'), verifiedAt: new Date().toISOString() };
  } finally { clearTimeout(timeout); controller.abort(); }
  const ready = (await pool.query("SELECT to_regclass('public.portal_resources') AS resources")).rows[0].resources;
  if (!ready) throw Error('A migração 009 precisa ser aplicada antes do cadastro. Este script não executa migrações.');
  const existing = (await pool.query("SELECT id,image_url FROM portal_resources WHERE kind='radio' AND (lower(name)='radio mix artigas' OR url=ANY($1::text[]))", [[website, 'https://radiomixartigas.com/']])).rows;
  if (existing.length > 1) throw Error('Mais de um cadastro existente; revisar antes de atualizar.');
  console.log(JSON.stringify({ target: 'UPOST.uy / Neon', verification, mode: process.argv.includes('--commit') ? 'commit' : 'dry-run', alreadyRegistered: existing.length === 1 }));
  if (process.argv.includes('--commit')) {
    const owner = (await pool.query("SELECT id FROM users WHERE role='OWNER' AND active AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1")).rows[0]?.id;
    if (!owner) throw Error('OWNER ativo não encontrado para auditoria.');
    let image = existing[0]?.image_url || '';
    if (!image) {
      try { const { importEditorialImage } = await import('../server/services/import-editorial-image.ts'); image = await importEditorialImage(website + 'assets/img/logo-radio-mix-artigas.png', owner); }
      catch { console.log('Logotipo não importado; rádio será cadastrada sem imagem, editável no painel.'); }
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const id = existing[0]?.id || randomUUID();
      await client.query(`INSERT INTO portal_resources(id,kind,name,url,description,image_url,media_type,stream_url,active,display_order)
        VALUES($1,'radio','Radio Mix Artigas',$2,'Artigas, Uruguay',$3,'Radio en vivo',$4,true,0)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,url=excluded.url,description=excluded.description,image_url=excluded.image_url,media_type=excluded.media_type,stream_url=excluded.stream_url,active=true,updated_at=now()`, [id, website, image, stream]);
      await client.query("INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES($1,'radio.verified_registration','portal_resources',$2,$3)", [owner, id, JSON.stringify(verification)]);
      await client.query('COMMIT');
      const record = (await client.query('SELECT id,name,url,description,image_url,media_type,stream_url,active FROM portal_resources WHERE id=$1', [id])).rows[0];
      await writeFile('test-results/radio-registration-result.json', JSON.stringify({ record, verification }, null, 2));
      console.log(JSON.stringify(record));
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await pool.end(); }
