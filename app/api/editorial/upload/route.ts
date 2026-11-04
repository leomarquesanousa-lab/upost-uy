import { getUser } from '@/lib/auth/session';
import { MAX_IMAGE_BYTES } from '@/lib/editorial/image.mjs';
import { EditorialError } from '@/lib/editorial/validation';
import { StorageError } from '@/server/services/r2-storage.mjs';
import { persistEditorialImage } from '@/server/services/editorial-media';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const user = await getUser();
  if (!user || !['OWNER','ADMIN','EDITOR'].includes(user.role)) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
  try {
    const expected = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (new URL(request.headers.get('origin') || '').host !== expected) throw new Error();
  } catch { return Response.json({ error: 'Origem inválida.' }, { status: 403 }); }
  if (Number(request.headers.get('content-length')) > MAX_IMAGE_BYTES) return Response.json({ error: 'O limite é 5 MB.' }, { status: 413 });
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > MAX_IMAGE_BYTES) { await reader.cancel(); return Response.json({ error: 'O limite é 5 MB.' }, { status: 413 }); }
      chunks.push(part.value);
    }
    const filename = decodeURIComponent(request.headers.get('x-file-name') || '').slice(0, 255);
    const url = await persistEditorialImage({ bytes: Buffer.concat(chunks), filename, mimeType: request.headers.get('content-type') || '' }, user.id, { sourceType: 'manual' });
    return Response.json({ url }, { status: 201 });
  } catch (error) {
    if (error instanceof EditorialError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: error instanceof StorageError ? error.message : 'Não foi possível concluir o upload. Tente novamente.' }, { status: 503 });
  }
}
