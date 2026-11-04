import { recordAd } from '@/server/services/ads';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const destination=await recordAd((await params).id,new URL(request.url).searchParams.get('receipt')||'','click');if(destination)return new Response(null,{status:302,headers:{Location:destination,'Cache-Control':'no-store'}});}catch{}return new Response('Anúncio indisponível.',{status:404,headers:{'Cache-Control':'no-store'}});}
export async function HEAD(){return new Response(null,{status:405,headers:{Allow:'GET','Cache-Control':'no-store'}});}
