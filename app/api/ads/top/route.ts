import { serveTopBanners } from '@/server/services/ads';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { return Response.json(await serveTopBanners(new URL(request.url).searchParams.get('carouselOnly') === '1'), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ slides: [], advertisement: null }, { headers: { 'Cache-Control': 'no-store' } }); }
}
