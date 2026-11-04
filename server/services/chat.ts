import 'server-only';
import { randomBytes,randomUUID,createHash } from 'node:crypto';
import { cookies,headers } from 'next/headers';
import { getPool } from '@/lib/db/pool';
import { cookieOptions } from '@/lib/auth/session';
import { consumeLimit } from './request-limit';
import { chatText } from '@/lib/programming/chat-input.mjs';
import { EditorialError } from '@/lib/editorial/validation';
const cookie=process.env.NODE_ENV==='production'?'__Host-biosfera_chat':'biosfera_chat';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export async function chatEnabled(){return (await getPool().query("SELECT value FROM settings WHERE key='CHAT_ENABLED'")).rows[0]?.value==='true';}
export async function visitor(){const token=(await cookies()).get(cookie)?.value;if(!token||!/^[a-f0-9]{64}$/.test(token))return null;return (await getPool().query('SELECT id,display_name,blocked FROM chat_visitors WHERE token_hash=$1 AND expires_at>now()',[hash(token)])).rows[0]??null;}
export async function readChat(admin=false,before?:string){
 const enabled=await chatEnabled();const who=await visitor();
 const messages=(!enabled&&!admin)?[]:(await getPool().query(`SELECT m.id::text,m.display_name,m.message,m.sender_type,m.status,m.created_at ${admin?',m.visitor_id,coalesce(v.blocked,false) AS blocked':''} FROM chat_messages m ${admin?'LEFT JOIN chat_visitors v ON v.id=m.visitor_id':''} WHERE ${admin?"true":"m.status='VISIBLE'"} AND ($1::bigint IS NULL OR m.id<$1::bigint) ORDER BY m.id DESC LIMIT $2`,[before&&/^\d{1,18}$/.test(before)?before:null,admin?60:30])).rows.reverse();
 return {enabled,visitor:who?{name:who.display_name,blocked:who.blocked}:null,messages};
}
export async function chatOrigin(){const h=await headers();try{if(new URL(h.get('origin')||'').host===(h.get('x-forwarded-host')||h.get('host')))return;}catch{}throw new EditorialError('Origem inválida.');}
export async function joinChat(name:unknown){
 if(!await chatEnabled())throw new EditorialError('Chat temporariamente indisponível.');
 let display:string;try{display=chatText(name,40);}catch(e){throw new EditorialError((e as Error).message);}
 const existing=await visitor();if(existing?.blocked)throw new EditorialError('Esta sessão está bloqueada.');if(existing)return;
 // Shared cap limits anonymous session creation without retaining IP addresses.
 if(!await consumeLimit('chat:joins',120,60))throw new EditorialError('Muitas entradas. Aguarde um minuto.');
 const token=randomBytes(32).toString('hex');await getPool().query("INSERT INTO chat_visitors(id,token_hash,display_name,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",[randomUUID(),hash(token),display]);
 (await cookies()).set(cookie,token,{...cookieOptions,maxAge:604800});
}
export async function sendChat(message:unknown,userId?:string){
 let body:string;try{body=chatText(message,500);}catch(e){throw new EditorialError((e as Error).message);}
 const who=userId?null:await visitor();if(!userId&&!who)throw new EditorialError('Entre no chat para enviar.');
 const client=await getPool().connect();
 try{await client.query('BEGIN');
 const setting=await client.query("SELECT value FROM settings WHERE key='CHAT_ENABLED' FOR SHARE");if(setting.rows[0]?.value!=='true')throw new EditorialError('Chat temporariamente indisponível.');
 if(who){const locked=await client.query('SELECT blocked,expires_at>now() AS valid FROM chat_visitors WHERE id=$1 FOR UPDATE',[who.id]);if(!locked.rows[0]?.valid||locked.rows[0].blocked)throw new EditorialError('Esta sessão está bloqueada ou expirou.');}
 if(!await consumeLimit(`chat:send:${userId||who.id}`,1,3,client))throw new EditorialError('Aguarde 3 segundos entre mensagens.');
 if(!await consumeLimit('chat:global',120,60,client))throw new EditorialError('Chat movimentado. Aguarde um minuto.');
 await client.query('INSERT INTO chat_messages(visitor_id,user_id,display_name,message,sender_type) VALUES($1,$2,$3,$4,$5)',[who?.id??null,userId??null,userId?'BIOSFERA':who.display_name,body,userId?'STAFF':'VISITOR']);await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function moderateChat(intent:string,id:string,userId:string){
 const client=await getPool().connect();try{await client.query('BEGIN');let result;
 if(['hide','delete','show'].includes(intent)&&/^\d{1,18}$/.test(id))result=await client.query("UPDATE chat_messages SET status=$1 WHERE id=$2 AND status<>'DELETED'",[intent==='hide'?'HIDDEN':intent==='delete'?'DELETED':'VISIBLE',id]);
 else if(['block','unblock'].includes(intent)&&/^[a-f0-9-]{36}$/.test(id))result=await client.query('UPDATE chat_visitors SET blocked=$1 WHERE id=$2',[intent==='block',id]);
 else if(['enable','disable'].includes(intent))result=await client.query("UPDATE settings SET value=$1,updated_at=now() WHERE key='CHAT_ENABLED'",[intent==='enable'?'true':'false']);
 else throw new EditorialError('Ação inválida.');
 if(!result.rowCount)throw new EditorialError('Registro indisponível.');await client.query('INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES($1,$2,$3,$4)',[userId,intent,'chat',id||'CHAT_ENABLED']);await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
