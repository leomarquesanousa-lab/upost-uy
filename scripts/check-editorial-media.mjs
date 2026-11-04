// Usage: node scripts/check-editorial-media.mjs --health
//        node scripts/check-editorial-media.mjs --path /media/<UUID>.webp
// Add --copy-local to copy only explicitly named, registered legacy images to R2.
import './env.mjs';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { registerHooks } from 'node:module';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { secureConnectionString } from '../lib/db/connection-string.mjs';
// Next's server-only marker is handled by its compiler; this entry point is Node-only.
registerHooks({ resolve(specifier, context, next) {
  return specifier === 'server-only' ? { url: 'data:text/javascript,export {}', shortCircuit: true } : next(specifier, context);
} });
const { checkR2Health, requiredR2Storage, statR2 } = await import('../server/services/r2-storage.mjs');

const args = process.argv.slice(2);
const paths = [];
let health = false, copyLocal = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--health') health = true;
  else if (args[i] === '--copy-local') copyLocal = true;
  else if (args[i] === '--path') paths.push(args[++i]);
  else throw new Error('Use --health e/ou --path /media/<UUID>.webp; --copy-local é opcional.');
}
if ((!health && !paths.length) || paths.length > 20 || paths.some(value => !/^\/media\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/.test(value || ''))) {
  throw new Error('Informe até 20 caminhos de imagens explícitos e válidos.');
}
let pool;
try {
  if (health) console.log(JSON.stringify(await checkR2Health()));
  if (paths.length) pool = new Pool({ connectionString: secureConnectionString(process.env.DATABASE_URL), connectionTimeoutMillis: 5000 });
  for (const url of new Set(paths)) {
    const record = (await pool.query('SELECT id,size,mime_type FROM media_assets WHERE path=$1', [url])).rows[0];
    const key = url.slice(1);
    let object = await statR2(key), copied = false;
    if (copyLocal && record && !object) {
      let bytes;
      for (const directory of [process.env.UPLOAD_DIR || 'storage/uploads', 'public/media']) {
        try { bytes = await readFile(path.resolve(directory, path.basename(url))); break; }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      if (bytes) {
        const metadata = await sharp(bytes, { limitInputPixels: 20000000 }).metadata();
        if (bytes.length !== record.size || metadata.format !== 'webp') throw new Error('Arquivo legado incompatível com o registro: ' + url);
        const storage = requiredR2Storage();
        // Never replace a remote object, including one created after the HEAD.
        await storage.client.send(new PutObjectCommand({ Bucket: storage.bucket, Key: key, Body: bytes, ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable', IfNoneMatch: '*' }));
        object = await statR2(key);
        if (!object || object.size !== bytes.length || object.mimeType !== 'image/webp') throw new Error('Cópia não confirmada: ' + url);
        copied = true;
      }
    }
    const usable = Boolean(record && object && object.size > 0 && object.mimeType === 'image/webp');
    console.log(JSON.stringify({ path: url, storageProvider: 'r2', objectKey: key, registered: Boolean(record), exists: Boolean(object), usable, recordedSize: record?.size ?? null, actualSize: object?.size ?? null, metadataMatches: Boolean(record && object && record.size === object.size && record.mime_type === object.mimeType), copied }));
    if (!usable) process.exitCode = 1;
  }
} catch {
  // SDK/pg errors may contain connection details; do not print them.
  console.error('Não foi possível concluir a verificação/cópia. Verifique acesso, configuração e compatibilidade dos arquivos.');
  process.exitCode = 1;
} finally { await pool?.end(); }
