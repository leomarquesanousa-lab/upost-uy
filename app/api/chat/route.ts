import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/session';
import { chatOrigin,readChat,joinChat,sendChat,moderateChat } from '@/server/services/chat';
import { EditorialError } from '@/lib/editorial/validation';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{const url=new URL(request.url),admin=url.searchParams.get('admin')==='1';if(admin&&!await getUser())return NextResponse.json({error:'Sessão expirada.'},{status:401});return NextResponse.json(await readChat(admin,admin?url.searchParams.get('before')||undefined:undefined),{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({error:'Chat temporariamente indisponível.'},{status:503});}
}
export async function POST(request:Request){
 try{await chatOrigin();const raw=await request.text();if(raw.length>3000)return NextResponse.json({error:'Conteúdo muito grande.'},{status:413});let body;try{body=JSON.parse(raw);}catch{throw new EditorialError('Solicitação inválida.');}if(!body||typeof body!=='object')throw new EditorialError('Solicitação inválida.');
 if(body.intent==='join')await joinChat(body.name);
 else if(body.intent==='send')await sendChat(body.message);
 else{const user=await getUser();if(!user)return NextResponse.json({error:'Sessão expirada.'},{status:401});if(body.intent==='reply')await sendChat(body.message,user.id);else await moderateChat(body.intent,String(body.id??''),user.id);}
 return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof EditorialError?e.message:'Chat temporariamente indisponível.'},{status:e instanceof EditorialError?400:503});}
}
