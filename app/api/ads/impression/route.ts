import { recordAd } from '@/server/services/ads';
import { chatOrigin } from '@/server/services/chat';
export async function POST(request:Request){try{await chatOrigin();const body=await request.text();if(body.length>300)return new Response(null,{status:413});const {id,receipt}=JSON.parse(body);const ok=await recordAd(id,receipt,'impression');return new Response(null,{status:ok?204:404});}catch{return new Response(null,{status:400});}}
