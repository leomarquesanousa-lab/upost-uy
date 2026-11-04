import { readVideoResponse } from '@/server/services/storage';

export const runtime = 'nodejs';
type Context = { params: Promise<{ filename: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const response = await readVideoResponse((await params).filename, request);
    return response ?? new Response('Vídeo não encontrado.', { status: 404 });
  } catch {
    return new Response('Armazenamento de vídeo temporariamente indisponível.', { status: 503 });
  }
}

export const HEAD = GET;
