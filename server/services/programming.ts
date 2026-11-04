import 'server-only';
import { cache } from 'react';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/db/pool';
import { text,uuid,slug,EditorialError } from '@/lib/editorial/validation';
import { resolveSchedule } from '@/lib/programming/engine.mjs';
export type Presenter={id:string;name:string;slug:string;bio:string;photo_url:string;social_instagram:string;social_facebook:string;social_x:string;active:boolean};
export type Program={id:string;name:string;slug:string;short_description:string;description:string;cover_image:string;active:boolean;presenters:Presenter[]};
export type Slot={id:string;weekday:number;date:string;program_id:string;start_time:string;end_time:string;active:boolean;title:string;note:string;cancelled:boolean;special?:boolean;program?:Program};
export type Kind='presenters'|'programs'|'schedule_slots'|'schedule_exceptions';
export const programmingData=cache(async()=>{
 const db=getPool();
 const [presenters,programs,relations,slots,exceptions,settings]=await Promise.all([
 db.query<Presenter>('SELECT * FROM presenters ORDER BY name'),db.query<Program>('SELECT * FROM programs ORDER BY name'),db.query('SELECT * FROM program_presenters'),
 db.query<Slot>("SELECT s.*,s.start_time::text,s.end_time::text FROM schedule_slots s ORDER BY s.weekday,s.start_time"),db.query<Slot>("SELECT s.*,s.date::text,s.start_time::text,s.end_time::text FROM schedule_exceptions s ORDER BY s.date,s.start_time"),db.query("SELECT value FROM settings WHERE key='PORTAL_TIMEZONE'")]);
 const enriched=programs.rows.map(p=>({...p,presenters:presenters.rows.filter(a=>relations.rows.some(r=>r.program_id===p.id&&r.presenter_id===a.id))}));
 const attach=(s:Slot)=>({...s,program:enriched.find(p=>p.id===s.program_id)});
 let timezone=settings.rows[0]?.value||process.env.PORTAL_TIMEZONE||'America/Sao_Paulo';
 try{new Intl.DateTimeFormat('pt-BR',{timeZone:timezone});}catch{timezone='America/Sao_Paulo';}
 return {presenters:presenters.rows,programs:enriched,slots:slots.rows.map(attach),exceptions:exceptions.rows.map(attach),timezone};
});
export const publicProgramming=cache(async()=>{
 try{const d=await programmingData();const programs=d.programs.filter(p=>p.active).map(p=>({...p,presenters:p.presenters.filter(a=>a.active)}));const attach=(s:Slot)=>({...s,program:programs.find(p=>p.id===s.program_id)});return {...d,programs,presenters:d.presenters.filter(p=>p.active),slots:d.slots.map(attach),exceptions:d.exceptions.map(attach)};}
 catch{return {presenters:[],programs:[],slots:[],exceptions:[],timezone:'America/Sao_Paulo'};}
});
export async function currentProgramming(){const d=await publicProgramming();return resolveSchedule(d.slots,d.exceptions,d.timezone);}
function url(value:string){if(!value)return '';if(/^\/media\/[a-zA-Z0-9._-]+$/.test(value))return value;try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}throw new EditorialError('Informe uma URL HTTPS válida.');}
export async function saveProgramming(kind:Kind,form:FormData,userId:string){
 if(!['presenters','programs','schedule_slots','schedule_exceptions'].includes(kind))throw new EditorialError('Tipo inválido.');
 const id=form.get('id')?uuid(String(form.get('id'))):randomUUID();
 const deleting=form.get('intent')==='delete';
 const values:Record<string,unknown>={};
 if(!deleting){
 values.active=form.get('active')==='on';
 if(kind==='presenters'||kind==='programs'){
  values.name=text(form,'name',120,true);values.slug=slug(form,String(values.name));
  for(const field of kind==='presenters'?['bio','photo_url','social_instagram','social_facebook','social_x']:['short_description','description','cover_image']){const v=text(form,field,field==='short_description'?400:field==='bio'||field==='description'?10000:2048);values[field]=field.includes('social_')||field==='photo_url'||field==='cover_image'?url(v):v;}
 }else{
  const start=text(form,'start_time',5,true),end=text(form,'end_time',5,true);
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(end)||start>=end)throw new EditorialError('Horários inválidos. Para atravessar meia-noite, cadastre duas faixas; use 24:00 no término.');
  values.start_time=start;values.end_time=end;
  if(kind==='schedule_slots'){const day=Number(text(form,'weekday',1,true));if(!Number.isInteger(day)||day<0||day>6)throw new EditorialError('Dia inválido.');values.weekday=day;}
  else{const date=text(form,'date',10,true);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new EditorialError('Data inválida.');values.date=date;values.title=text(form,'title',120);values.note=text(form,'note',600);values.cancelled=form.get('cancelled')==='on';}
  values.program_id=values.cancelled?null:uuid(text(form,'program_id',36,true));
 }
 }
 const client=await getPool().connect();
 try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(84201904)');
 if(deleting){const r=await client.query(`DELETE FROM ${kind} WHERE id=$1`,[id]);if(!r.rowCount)throw new EditorialError('Registro não encontrado.');}
 else{
 const keys=Object.keys(values),params=Object.values(values);
 if(form.get('id')){const r=await client.query(`UPDATE ${kind} SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')},updated_at=now() WHERE id=$${keys.length+1}`,[...params,id]);if(!r.rowCount)throw new EditorialError('Registro não encontrado.');}
 else await client.query(`INSERT INTO ${kind}(id,${keys.join(',')}) VALUES($1,${keys.map((_,i)=>`$${i+2}`).join(',')})`,[id,...params]);
 if(kind==='programs'){const ids=[...new Set(form.getAll('presenter_ids').map(v=>uuid(String(v))))];if(ids.length>30)throw new EditorialError('Selecione até 30 apresentadores.');await client.query('DELETE FROM program_presenters WHERE program_id=$1',[id]);for(const presenter of ids)await client.query('INSERT INTO program_presenters VALUES($1,$2)',[id,presenter]);}
 }
 await client.query('INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES($1,$2,$3,$4)',[userId,deleting?'delete':form.get('id')?'update':'create',kind,id]);await client.query('COMMIT');return id;
 }catch(e){await client.query('ROLLBACK');const code=(e as {code?:string}).code;if(code==='23P01')throw new EditorialError('Conflito: já existe uma faixa ativa nesse horário.');if(code==='23505')throw new EditorialError('Este slug já está em uso.');if(code==='23503')throw new EditorialError('Registro associado à programação. Remova os vínculos ou desative o cadastro.');throw e;}finally{client.release();}
}
