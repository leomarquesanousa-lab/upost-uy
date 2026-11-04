import 'server-only';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

export class StorageError extends Error {}

const names = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ENDPOINT', 'R2_PUBLIC_URL'];
let cached;

export function r2Storage() {
  const values = names.map(name => process.env[name]?.trim() || '');
  if (!values.some(Boolean)) return null;
  const [account, accessKeyId, secretAccessKey, bucket, configuredEndpoint, publicUrl] = values;
  if (!accessKeyId || !secretAccessKey || !bucket || (!configuredEndpoint && !account) || !publicUrl) {
    throw new StorageError('Configuração R2 incompleta. Verifique as variáveis R2 do servidor.');
  }
  const endpoint = configuredEndpoint || `https://${account}.r2.cloudflarestorage.com`;
  for (const value of [endpoint, publicUrl]) {
    let url;
    try { url = new URL(value); } catch { throw new StorageError('URL do R2 inválida.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw new StorageError('As URLs do R2 devem usar HTTPS, sem credenciais ou parâmetros.');
    }
  }
  const signature = JSON.stringify(values);
  if (cached?.signature !== signature) {
    cached?.client.destroy();
    cached = {
      signature, bucket, publicUrl: publicUrl.replace(/\/+$/, ''),
      client: new S3Client({
        region: 'auto', endpoint, forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey },
        requestChecksumCalculation: 'WHEN_REQUIRED',
        maxAttempts: 3,
      }),
    };
  }
  return cached;
}

export function requiredR2Storage() {
  const storage = r2Storage();
  if (!storage) throw new StorageError('Configure o R2 antes de enviar imagens editoriais.');
  return storage;
}

export async function statR2(key) {
  const storage = requiredR2Storage();
  try {
    const object = await storage.client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: key }));
    return { size: object.ContentLength, mimeType: object.ContentType };
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404) return null;
    throw new StorageError('Não foi possível verificar a mídia no R2.');
  }
}

export async function readR2Object(key) {
  const storage = requiredR2Storage();
  try {
    const object = await storage.client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }));
    return Buffer.from(await object.Body.transformToByteArray());
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404) return null;
    throw new StorageError('Não foi possível ler a mídia no R2.');
  }
}

export async function checkR2Health() {
  const storage = requiredR2Storage();
  try {
    await storage.client.send(new HeadBucketCommand({ Bucket: storage.bucket }));
    return { storageProvider: 'r2', bucket: storage.bucket, prefix: 'media/', accessible: true };
  } catch { throw new StorageError('Não foi possível acessar o bucket R2.'); }
}

export async function putR2(key, bytes, contentType) {
  const storage = r2Storage();
  if (!storage) return false;
  try {
    await storage.client.send(new PutObjectCommand({
      Bucket: storage.bucket, Key: key, Body: bytes, ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  } catch { throw new StorageError('Não foi possível gravar a mídia no R2.'); }
  return true;
}

export async function readR2(key, request = new Request('https://storage.invalid')) {
  const storage = r2Storage();
  if (!storage) return null;
  const headers = new Headers();
  for (const name of ['range', 'if-range']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  let upstream;
  try {
    upstream = await fetch(`${storage.publicUrl}/${key}`, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET', headers,
      cache: 'no-store', signal: request.signal,
    });
  } catch { throw new Error('Não foi possível ler a mídia no R2.'); }
  if (upstream.status === 404) {
    await upstream.body?.cancel();
    return null;
  }
  if (![200, 206, 416].includes(upstream.status)) {
    await upstream.body?.cancel();
    throw new Error('Não foi possível ler a mídia no R2.');
  }
  const responseHeaders = new Headers({ 'X-Content-Type-Options': 'nosniff' });
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified', 'cache-control']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export async function discardR2(key) {
  const storage = r2Storage();
  if (!storage) return;
  try {
    await storage.client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }));
  } catch { throw new Error('Não foi possível remover a mídia do R2.'); }
}
