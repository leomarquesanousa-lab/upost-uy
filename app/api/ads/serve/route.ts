import { serveAd } from '@/server/services/ads';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return Response.json(await serveAd(new URL(request.url).searchParams.get('slot')||''),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json(null,{headers:{'Cache-Control':'no-store'}});}}
