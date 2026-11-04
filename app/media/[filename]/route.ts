import { readImage } from '@/server/services/storage';
import { StorageError } from '@/server/services/r2-storage.mjs';
export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  let bytes;
  try { bytes = await readImage((await params).filename); }
  catch (error) {
    if (error instanceof StorageError) return new Response('Storage de imagens indisponível.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    throw error;
  }
  if (!bytes) return new Response('Imagem não encontrada.', { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  } });
}
