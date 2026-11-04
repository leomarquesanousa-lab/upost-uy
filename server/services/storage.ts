import 'server-only';
import { putR2, readR2, discardR2, statR2, readR2Object, requiredR2Storage, r2Storage, StorageError } from './r2-storage.mjs';

import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';
import { randomUUID } from 'node:crypto';

const uploadDirectory = () =>
  path.resolve(
    process.env.UPLOAD_DIR ||
      'storage/uploads',
  );

const publicMediaDirectory = () =>
  path.resolve('public/media');

const IMAGE_FILENAME_REGEX =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/;

const VIDEO_FILENAME_REGEX =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(mp4|webm)$/;

export async function storeImage(
  bytes: Buffer,
) {
  const filename =
    `${randomUUID()}.webp`;

  requiredR2Storage();
  const key = `media/${filename}`;
  await putR2(key, bytes, 'image/webp');
  try {
    const object = await statR2(key);
    if (!object || object.size !== bytes.length || object.mimeType !== 'image/webp') {
      throw new StorageError('A imagem não foi confirmada no R2. Envie novamente.');
    }
  } catch (error) {
    // Only this newly allocated UUID can be cleaned up; never a pre-existing asset.
    await discardR2(key).catch(() => console.error('Falha ao limpar upload não confirmado no R2.'));
    throw error;
  }
  return `/media/${filename}`;
}

async function readLocalImage(
  filename: string,
) {
  if (
    !IMAGE_FILENAME_REGEX.test(
      filename,
    )
  ) {
    return null;
  }

  try {
    return await readFile(
      path.join(
        uploadDirectory(),
        filename,
      ),
    );
  } catch {
  }

  try {
    return await readFile(
      path.join(
        publicMediaDirectory(),
        filename,
      ),
    );
  } catch {
    return null;
  }
}

export async function discardImage(
  url: string,
) {
  const filename =
    url.split('/').pop() || '';

  if (
    !IMAGE_FILENAME_REGEX.test(
      filename,
    )
  ) {
    return;
  }

  await discardR2(`media/${filename}`).catch(() => console.error('Falha ao remover mídia do R2.'));

}

export async function storeVideo(
  bytes: Buffer,
  mimeType: string,
) {
  let extension:
    | 'mp4'
    | 'webm';

  if (
    mimeType === 'video/mp4'
  ) {
    extension = 'mp4';
  } else if (
    mimeType === 'video/webm'
  ) {
    extension = 'webm';
  } else {
    throw new Error(
      'Formato de vídeo inválido.',
    );
  }

  const filename =
    `${randomUUID()}.${extension}`;

  if (await putR2(`video-media/${filename}`, bytes, mimeType)) return `/video-media/${filename}`;

  await mkdir(
    uploadDirectory(),
    {
      recursive: true,
    },
  );

  await writeFile(
    path.join(
      uploadDirectory(),
      filename,
    ),
    bytes,
    {
      flag: 'wx',
    },
  );

  return `/video-media/${filename}`;
}

async function readLocalVideo(
  filename: string,
) {
  if (
    !VIDEO_FILENAME_REGEX.test(
      filename,
    )
  ) {
    return null;
  }

  try {
    return await readFile(
      path.join(
        uploadDirectory(),
        filename,
      ),
    );
  } catch {
    return null;
  }
}

export async function discardVideo(
  url: string,
) {
  const filename =
    url.split('/').pop() || '';

  if (
    !VIDEO_FILENAME_REGEX.test(
      filename,
    )
  ) {
    return;
  }

  await discardR2(`video-media/${filename}`).catch(() => console.error('Falha ao remover mídia do R2.'));

  await unlink(
    path.join(
      uploadDirectory(),
      filename,
    ),
  ).catch(() => {});
}

export function videoContentType(
  filename: string,
) {
  if (
    filename.endsWith('.mp4')
  ) {
    return 'video/mp4';
  }

  if (
    filename.endsWith('.webm')
  ) {
    return 'video/webm';
  }

  return null;
}
export async function readImage(filename: string) {
  if (!IMAGE_FILENAME_REGEX.test(filename)) return null;
  // Signed R2 reads do not depend on a public CDN host or cached CDN 404s.
  if (r2Storage() || process.env.NODE_ENV === 'production') {
    const remote = await readR2Object('media/' + filename);
    if (remote || process.env.NODE_ENV === 'production') return remote;
  }
  // Read-only compatibility for legacy development files. New writes always use R2.
  return readLocalImage(filename);
}

export async function imageObjectInfo(url: string) {
  if (!url.startsWith('/media/') || !IMAGE_FILENAME_REGEX.test(url.slice(7))) return null;
  return statR2(url.slice(1));
}

export async function readVideo(filename: string) {
  if (!VIDEO_FILENAME_REGEX.test(filename)) return null;
  const local = await readLocalVideo(filename);
  if (local) return local;
  const remote = await readR2('video-media/' + filename);
  return remote ? Buffer.from(await remote.arrayBuffer()) : null;
}

// Preserve the public URL and stream remote video, including byte ranges.
export async function readVideoResponse(filename: string, request: Request) {
  if (!VIDEO_FILENAME_REGEX.test(filename)) return null;
  const local = await readLocalVideo(filename);
  if (!local) {
    const remote = await readR2('video-media/' + filename, request);
    if (remote) remote.headers.set('Content-Type', videoContentType(filename)!);
    return remote;
  }
  const headers = new Headers({
    'Content-Type': videoContentType(filename)!,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=3600',
    'Accept-Ranges': 'bytes',
  });
  const range = request.method === 'GET' && !request.headers.has('if-range')
    ? /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '') : null;
  let start = 0, end = local.length - 1, status = 200;
  if (range && (range[1] || range[2])) {
    start = range[1] ? Number(range[1]) : Math.max(0, local.length - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= local.length) {
      headers.set('Content-Range', 'bytes */' + local.length);
      return new Response(null, { status: 416, headers });
    }
    status = 206;
    headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + local.length);
  }
  headers.set('Content-Length', String(end - start + 1));
  return new Response(request.method === 'HEAD' ? null : new Uint8Array(local.subarray(start, end + 1)), { status, headers });
}
