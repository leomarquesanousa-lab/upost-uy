// Dry run by default. --commit replaces only HOME_TOP content, never the schema.
import './env.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { databaseIdentity } from '../lib/editorial/initial-import.mjs';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: new URL('../node_modules/next/dist/compiled/server-only/empty.js', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('@/') || (specifier.startsWith('.') && context.parentURL?.startsWith(new URL('../', import.meta.url).href) && !context.parentURL.includes('/node_modules/'))) {
    const base = specifier.startsWith('@/') ? new URL('../' + specifier.slice(2), import.meta.url) : new URL(specifier, context.parentURL);
    for (const suffix of ['', '.ts', '.mjs']) { const url = new URL(base.href + suffix); if (existsSync(url)) return next(url.href, context); }
  }
  return next(specifier, context);
} });
const guard = JSON.parse(await readFile(new URL('./initial-news.json', import.meta.url)));
if (process.env.SITE_NAME !== 'UPOST.uy' || databaseIdentity(process.env.DATABASE_URL || '').fingerprint !== guard.databaseFingerprint) throw Error('Banco exclusivo do UPOST não confirmado.');
const photos = JSON.parse(await readFile(new URL('./uruguay-banners.json', import.meta.url)));
const { getPool } = await import('../lib/db/pool.ts');
const { persistEditorialImage, inspectEditorialImage } = await import('../server/services/editorial-media.ts');
const pool = getPool();
const commit = process.argv.includes('--commit');
async function crop(bytes, width, height, focus) {
  const meta = await sharp(bytes).metadata();
  const ratio = width / height;
  const w = Math.min(meta.width, Math.floor(meta.height * ratio));
  const h = Math.min(meta.height, Math.floor(meta.width / ratio));
  const left = Math.max(0, Math.min(meta.width - w, Math.round(meta.width * focus[0] - w / 2)));
  const top = Math.max(0, Math.min(meta.height - h, Math.round(meta.height * focus[1] - h / 2)));
  return sharp(bytes).extract({ left, top, width: w, height: h }).resize(width, height).webp({ quality: 90 }).toBuffer();
}
try {
  const slot = (await pool.query("SELECT id FROM ad_slots WHERE code='HOME_TOP'")).rows[0];
  if (!slot) throw Error('HOME_TOP não cadastrado.');
  const owner = (await pool.query("SELECT id FROM users WHERE role='OWNER' AND active AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1")).rows[0]?.id;
  if (!owner) throw Error('OWNER ativo não encontrado.');
  const before = (await pool.query('SELECT * FROM ad_campaigns WHERE slot_id=$1 ORDER BY priority DESC,created_at,id', [slot.id])).rows;
  await mkdir('test-results/uruguay-banners', { recursive: true });
  const prepared = [];
  for (const [index, photo] of photos.entries()) {
    const old = before.find(c => c.name === photo.name);
    // A repeated run reuses already registered media instead of duplicating assets.
    if (old && (await inspectEditorialImage(old.image_url)).usable && old.mobile_image_url && (await inspectEditorialImage(old.mobile_image_url)).usable) {
      prepared.push({ ...photo, id: old.id, image: old.image_url, mobile: old.mobile_image_url }); continue;
    }
    const query = new URLSearchParams({ action: 'query', format: 'json', titles: photo.file, prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '2560' });
    const response = await fetch('https://commons.wikimedia.org/w/api.php?' + query, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error('Commons indisponível: ' + photo.file);
    const info = Object.values((await response.json()).query.pages)[0].imageinfo?.[0];
    if (!info || info.width * info.height > 20000000 || info.size > 10000000) throw Error('Imagem incompatível: ' + photo.file);
    const source = new URL(info.thumburl || info.url); source.search = '';
    if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(source.hostname)) throw Error('Origem inesperada.');
    const download = await fetch(source, { signal: AbortSignal.timeout(30000) });
    if (!download.ok) throw Error('Falha no download HTTP ' + download.status + ': ' + source);
    const bytes = Buffer.from(await download.arrayBuffer());
    if (bytes.length > 10000000) throw Error('Download excedeu o limite.');
    const desktop = await crop(bytes, 1720, 336, photo.focus);
    const mobile = await crop(bytes, 900, 300, photo.focus);
    await writeFile(`test-results/uruguay-banners/${index}-desktop.webp`, desktop);
    await writeFile(`test-results/uruguay-banners/${index}-mobile.webp`, mobile);
    const origin = { sourceType: 'import', sourceHost: source.hostname };
    const image = commit ? await persistEditorialImage({ bytes: desktop, filename: 'banner.webp', mimeType: 'image/webp' }, owner, origin) : '';
    const small = commit ? await persistEditorialImage({ bytes: mobile, filename: 'banner-mobile.webp', mimeType: 'image/webp' }, owner, origin) : '';
    prepared.push({ ...photo, id: old?.id || randomUUID(), image, mobile: small });
  }
  if (commit) {
    await mkdir('storage/backups', { recursive: true });
    await writeFile(`storage/backups/home-top-before-uruguay-${new Date().toISOString().replaceAll(':', '-')}.json`, JSON.stringify(before, null, 2), { flag: 'wx' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(84201907)');
      await client.query('UPDATE ad_campaigns SET active=false,updated_at=now() WHERE slot_id=$1 AND NOT(id=ANY($2::uuid[]))', [slot.id, prepared.map(p => p.id)]);
      await client.query('UPDATE ad_slots SET active=true,updated_at=now() WHERE id=$1', [slot.id]);
      for (const [index, p] of prepared.entries()) {
        await client.query(`INSERT INTO ad_campaigns(id,name,advertiser_name,slot_id,image_url,mobile_image_url,alt_text,destination_url,start_at,end_at,active,priority)
          VALUES($1,$2,'UPOST.uy',$3,$4,$5,$6,'',now(),NULL,true,$7)
          ON CONFLICT(id) DO UPDATE SET image_url=excluded.image_url,mobile_image_url=excluded.mobile_image_url,alt_text=excluded.alt_text,destination_url='',start_at=now(),end_at=NULL,active=true,priority=excluded.priority,updated_at=now()`, [p.id, p.name, slot.id, p.image, p.mobile, p.alt, 1000-index]);
        const photoCredit = { author: p.author, license: p.license, source: 'https://commons.wikimedia.org/wiki/' + p.file.replaceAll(' ', '_') };
        await client.query("INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES($1,'ads.uruguay_photo','ad_campaigns',$2,$3)", [owner, p.id, JSON.stringify({ image_url: p.image, photoCredit, licenseUrl: p.licenseUrl, changes: 'Recorte y conversión WebP; 1720×336 y 900×300', replacedCampaignIds: before.filter(c => !prepared.some(p => p.id === c.id)).map(c => c.id) })]);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  await writeFile('test-results/uruguay-banners/result.json', JSON.stringify({ committed: commit, photos: prepared }, null, 2));
  console.log(JSON.stringify({ committed: commit, photos: prepared.map(p => ({ name: p.name, image: p.image, mobile: p.mobile })) }, null, 2));
} finally { await pool.end(); }
