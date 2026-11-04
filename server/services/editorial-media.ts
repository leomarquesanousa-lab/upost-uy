import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db/pool';
import { EditorialError } from '@/lib/editorial/validation';
import { normalizeImage } from '@/lib/editorial/image.mjs';
import { storeImage, discardImage, imageObjectInfo } from './storage';

type UploadOrigin = { sourceType: 'manual' } | { sourceType: 'import'; sourceHost: string };

export async function persistEditorialImage(
  input: { bytes: Buffer; filename: string; mimeType: string },
  userId: string,
  origin: UploadOrigin,
) {
  let bytes: Buffer;
  try { bytes = await normalizeImage(input.bytes, input.filename, input.mimeType); }
  catch { throw new EditorialError('Use JPEG, PNG ou WebP válido, até 5 MB e 20 megapixels.'); }
  const url = await storeImage(bytes); // PUT and HEAD must succeed before any database write.
  let client: PoolClient | undefined;
  let commitAttempted = false;
  try {
    client = await getPool().connect();
    await client.query('BEGIN');
    const id = randomUUID();
    await client.query("INSERT INTO media_assets(id,path,mime_type,size,created_by) VALUES($1,$2,'image/webp',$3,$4)", [id,url,bytes.length,userId]);
    const metadata = {
      storageProvider: 'r2', objectKey: url.slice(1), size: bytes.length,
      mimeType: 'image/webp', ...origin, createdAt: new Date().toISOString(),
    };
    await client.query("INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES($1,'media.upload','media_assets',$2,$3)", [userId,id,JSON.stringify(metadata)]);
    commitAttempted = true;
    await client.query('COMMIT');
    return url;
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    // A lost COMMIT acknowledgement is ambiguous: keep the bytes rather than risk
    // deleting an object whose database transaction may have committed.
    if (!commitAttempted) await discardImage(url);
    throw error;
  } finally { client?.release(); }
}

export async function inspectEditorialImage(url: string, db: Pick<PoolClient, 'query'> = getPool()) {
  const record = (await db.query<{ id: string; size: number; mime_type: string }>(
    'SELECT id,size,mime_type FROM media_assets WHERE path=$1', [url],
  )).rows[0];
  const object = await imageObjectInfo(url);
  return {
    path: url, storageProvider: 'r2', objectKey: url.slice(1),
    registered: Boolean(record), exists: Boolean(object),
    usable: Boolean(record && object && object.size > 0 && object.mimeType === 'image/webp'),
    recordedSize: record?.size ?? null, actualSize: object?.size ?? null,
    metadataMatches: Boolean(record && object && record.size === object.size && record.mime_type === object.mimeType),
  };
}

export async function assertEditorialImage(url: string, db: Pick<PoolClient, 'query'>) {
  if (!url) return;
  try {
    if (!(await inspectEditorialImage(url, db)).usable) {
      throw new EditorialError(`Imagem ausente no R2 (${url}). Envie novamente antes de salvar.`);
    }
  } catch (error) {
    if (error instanceof EditorialError) throw error;
    throw new EditorialError('Não foi possível confirmar a imagem no R2. Tente novamente antes de salvar.');
  }
}
