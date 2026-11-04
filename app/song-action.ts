'use server';
import { cookies, headers } from 'next/headers';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getPool } from '@/lib/db/pool';
import { consumeLimit } from '@/server/services/request-limit';
export async function requestSong(form: FormData) {
  const h=await headers();
  try { if(new URL(h.get('origin') || '').host!==(h.get('x-forwarded-host') || h.get('host'))) return {error:'Origem inválida.'}; }
  catch { return {error:'Origem inválida.'}; }
  const name=String(form.get('name') || '').trim();
  const song=String(form.get('song') || '').trim();
  const message=String(form.get('message') || '').trim();
  const elapsed=Date.now()-Number(form.get('started_at'));
  if(form.get('website') || !Number.isFinite(elapsed) || elapsed<2000 || elapsed>86400000) return {error:'Aguarde alguns segundos e tente novamente.'};
  if(name.length<2 || name.length>100 || song.length<2 || song.length>200 || message.length>600) return {error:'Informe nome e música/artista válidos. Mensagem: até 600 caracteres.'};
  const jar=await cookies();
  let visitor=jar.get('biosfera_listener')?.value || '';
  if(!/^[a-f0-9]{32}$/.test(visitor)) visitor=randomBytes(16).toString('hex');
  jar.set('biosfera_listener',visitor,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:86400});
  const key=createHash('sha256').update(visitor).digest('hex');
  let client;
  try {
    client=await getPool().connect();
    await client.query('BEGIN');
    const globalAllowed=await consumeLimit('song:global',30,600,client);
    const visitorAllowed=globalAllowed && await consumeLimit(`song:${key}`,3,600,client);
    if(!visitorAllowed) { await client.query('COMMIT'); return {error:'Limite de pedidos atingido. Aguarde 10 minutos.'}; }
    await client.query('INSERT INTO song_requests(id,name,song,message) VALUES($1,$2,$3,$4)',[randomUUID(),name,song,message]);
    await client.query("DELETE FROM request_limits WHERE window_start<now()-interval '1 day'");
    await client.query('COMMIT');
    return {ok:true};
  } catch { if(client) await client.query('ROLLBACK').catch(()=>{}); return {error:'Não foi possível enviar agora. Tente novamente mais tarde.'}; }
  finally {client?.release();}
}
