import { marketSnapshot } from '@/server/services/market';
export async function GET() {
  return Response.json({ indicators: await marketSnapshot() }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' } });
}
