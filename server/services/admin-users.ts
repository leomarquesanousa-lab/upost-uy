import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db/pool';
import { SESSION_COOKIE,type AdminUser } from '@/lib/auth/session';
import { hashPassword,verifyPassword,tokenHash } from '@/lib/security/password.mjs';
import { canManageUser,validatePassword } from '@/lib/admin/policy.mjs';
import { text,uuid,EditorialError } from '@/lib/editorial/validation';
import { consumeLimit } from './request-limit';
export type ManagedUser=AdminUser&{active:boolean;created_at:string;updated_at:string;last_login_at:string|null};
const columns='id,name,email,role,active,created_at::text,updated_at::text,last_login_at::text';
export async function managedUsers(search='',role='',active='',page=1){
 const params=[search.slice(0,120),['OWNER','ADMIN','EDITOR'].includes(role)?role:'',active==='true'?'true':active==='false'?'false':''];
 const where="deleted_at IS NULL AND ($1='' OR name ILIKE '%'||$1||'%' OR email ILIKE '%'||$1||'%') AND ($2='' OR role=$2) AND ($3='' OR active::text=$3)";
 const [rows,count]=await Promise.all([getPool().query<ManagedUser>(`SELECT ${columns} FROM users WHERE ${where} ORDER BY name,id LIMIT 30 OFFSET $4`,[...params,(page-1)*30]),getPool().query(`SELECT count(*)::int AS total FROM users WHERE ${where}`,params)]);
 return {items:rows.rows,total:count.rows[0].total};
}
export async function managedUser(id:string){return (await getPool().query<ManagedUser>(`SELECT ${columns} FROM users WHERE id=$1 AND deleted_at IS NULL`,[uuid(id)])).rows[0]??null;}
async function freshActor(client:PoolClient,id:string){
 const token=(await cookies()).get(SESSION_COOKIE)?.value||'';
 const result=await client.query<AdminUser>('SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE u.id=$1 AND u.active AND u.deleted_at IS NULL AND s.token_hash=$2 AND s.expires_at>now()',[id,tokenHash(token)]);
 if(!result.rows[0])throw new EditorialError('Sua sessão expirou. Entre novamente.');return result.rows[0];
}
function password(form:FormData){try{return validatePassword(form.get('password'),form.get('confirmation'));}catch(e){throw new EditorialError((e as Error).message);}}
export async function saveUser(form:FormData,actorId:string,self=false){
 const intent=String(form.get('intent')||'save');if(!['save','reset','delete','password','activate','deactivate'].includes(intent))throw new EditorialError('Ação inválida.');
 if(self&&!['save','password'].includes(intent))throw new EditorialError('Ação inválida.');
 const suppliedId=String(form.get('id')||'');const id=self?actorId:suppliedId?uuid(suppliedId):randomUUID();const creating=!self&&!suppliedId;
 if(creating&&intent!=='save')throw new EditorialError('Cadastre o usuário primeiro.');
 let encoded:string|undefined;
 if(creating||intent==='reset'||intent==='password'){
  if(!await consumeLimit(`password-change:${actorId}`,10,900))throw new EditorialError('Muitas tentativas. Aguarde 15 minutos.');
  encoded=await hashPassword(password(form));
 }
 const client=await getPool().connect();try{
 await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(84201905)');
 const actor=await freshActor(client,actorId);
 const existing=creating?null:(await client.query('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id])).rows[0];
 if(!creating&&!existing)throw new EditorialError('Usuário não encontrado.');
 if(self&&(form.has('role')||form.has('email')||form.has('active')))throw new EditorialError('Minha Conta permite alterar apenas nome e senha.');
 const role=self?actor.role:intent==='save'?text(form,'role',10,true):existing.role;
 if(!['OWNER','ADMIN','EDITOR'].includes(role)||(!self&&!canManageUser(actor.role,existing?.role||role,role)))throw new EditorialError('Você não tem permissão para gerenciar este usuário ou conceder este papel.');
 let active=self?true:intent==='delete'||intent==='deactivate'?false:intent==='activate'?true:intent==='save'?form.get('active')==='on':existing.active;
 if(existing?.role==='OWNER'&&existing.active&&(!active||role!=='OWNER')){
  const owners=await client.query("SELECT count(*)::int AS n FROM users WHERE role='OWNER' AND active AND deleted_at IS NULL");
  if(owners.rows[0].n<=1)throw new EditorialError('O último OWNER ativo não pode ser desativado, excluído ou rebaixado.');
 }
 const events:string[]=[];
 if(intent==='password'){
  const current=String(form.get('current_password')||'');if(!current||current.length>256||!await verifyPassword(current,existing.password_hash))throw new EditorialError('Senha atual incorreta.');
 }
 if(intent==='reset'||intent==='password'){await client.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',[encoded,id]);events.push(intent==='reset'?'users.password_reset':'users.password_changed');}
 else if(intent==='delete'){active=false;await client.query('UPDATE users SET active=false,deleted_at=now(),updated_at=now() WHERE id=$1',[id]);events.push('users.deleted');}
 else if(intent==='activate'||intent==='deactivate'){
  await client.query('UPDATE users SET active=$1,updated_at=now() WHERE id=$2',[active,id]);
  if(existing.active!==active)events.push(active?'users.activated':'users.deactivated');
 }
 else{
  const name=text(form,'name',120,true),email=self?existing.email:text(form,'email',254,true).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new EditorialError('Informe um e-mail válido.');
  if(creating){await client.query('INSERT INTO users(id,name,email,role,active,password_hash) VALUES($1,$2,$3,$4,$5,$6)',[id,name,email,role,active,encoded]);events.push('users.created');}
  else{await client.query('UPDATE users SET name=$1,email=$2,role=$3,active=$4,updated_at=now() WHERE id=$5',[name,email,role,active,id]);events.push('users.updated');if(existing.role!==role)events.push('users.role_changed');if(existing.active!==active)events.push(active?'users.activated':'users.deactivated');}
 }
 const revoked=Boolean(encoded&&!creating)||!active||Boolean(existing&&existing.role!==role);
 if(revoked)await client.query('DELETE FROM sessions WHERE user_id=$1',[id]);
 for(const event of events)await client.query('INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES($1,$2,\'users\',$3,$4)',[actorId,event,id,JSON.stringify({role,active})]);
 await client.query('COMMIT');return {id,reauth:revoked&&id===actorId};
 }catch(e){await client.query('ROLLBACK');if((e as {code?:string}).code==='23505')throw new EditorialError('Este e-mail já está cadastrado.');throw e;}finally{client.release();}
}
