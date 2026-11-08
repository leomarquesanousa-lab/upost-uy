'use server';
import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {operationsMutation} from '@/lib/auth/operations';
import {getPool} from '@/lib/db/pool';
import {text,uuid,EditorialError,mediaPath} from '@/lib/editorial/validation';
import {remoteUrl} from '@/lib/security/remote-page.mjs';
import {assertEditorialImage} from '@/server/services/editorial-media';
import {automationInput,sourceEntries,initialSources,automaticSources,retrySource} from '@/lib/editorial/source-sync.mjs';
import {fetchRemoteFeed,fetchRemotePage} from '@/lib/security/remote-page.mjs';
import {automationData,synchronizeSources} from '@/server/services/source-automation';
import {saveTaxonomy} from '@/server/services/editorial';
import {discoverFeedUrl} from '@/lib/editorial/cover-images.mjs';
import {retentionPolicy} from '@/server/services/news-lifecycle';
import {isMediosPublicos} from '@/lib/editorial/medios-publicos.mjs';
export async function saveResource(form:FormData):Promise<{error?:string;ok?:boolean}>{
 try{
  const user=await operationsMutation(); const kind=text(form,'kind',20,true);
  if(!['partner','radio','source'].includes(kind))throw new EditorialError('Tipo de recurso inválido.');
  const id=text(form,'id',36)||randomUUID();uuid(id);
  const name=text(form,'name',200,true),url=remoteUrl(text(form,'url',2048,true)).href;
  const stream=text(form,'stream_url',2048);let feed=text(form,'feed_url',2048);
  if(stream && remoteUrl(stream).protocol!=='https:')throw new EditorialError('El stream debe usar HTTPS.');
  if(feed)remoteUrl(feed);
  if(kind!=='radio'&&!feed&&form.get('automation_enabled')==='on'){
   const page=await retrySource(()=>fetchRemotePage(url,{allowGzip:isMediosPublicos(url)}));feed=discoverFeedUrl(page.html,page.url)||'';
  }
  const order=Number(text(form,'display_order',10)||0);
  if(!Number.isSafeInteger(order)||Math.abs(order)>100000)throw new EditorialError('Orden inválido.');
  const image=mediaPath(text(form,'image_url',200));
  const client=await getPool().connect();
  try{await client.query('BEGIN');await assertEditorialImage(image,client);
   await client.query(`INSERT INTO portal_resources(id,kind,name,url,description,image_url,media_type,stream_url,feed_url,category_slug,active,display_order)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,url=excluded.url,description=excluded.description,image_url=excluded.image_url,media_type=excluded.media_type,stream_url=excluded.stream_url,feed_url=excluded.feed_url,category_slug=excluded.category_slug,active=excluded.active,display_order=excluded.display_order,updated_at=now()
    WHERE portal_resources.kind=excluded.kind`,
    [id,kind,name,url,text(form,'description',4000),image,text(form,'media_type',100),stream,feed,text(form,'category_slug',180),form.get('active')==='on',order]);
   if(kind!=='radio'&&form.get('automation_present')==='1'){
    const config=automationInput(form);
    if(!(await retentionPolicy(client)).ready)throw new EditorialError('La configuración de límites requiere activar la migración 011.');
    const category=text(form,'category_slug',180);
    if(config.enabled&&!(await client.query('SELECT id FROM categories WHERE slug=$1 AND active',[category])).rowCount)throw new EditorialError('Seleccioná una categoría activa.');
    if(config.enabled){const options={allowGzip:isMediosPublicos(url)};const page=await retrySource(()=>feed?fetchRemoteFeed(feed,options):fetchRemotePage(url,options));sourceEntries(page.html,url,Boolean(feed));}
    await client.query(`INSERT INTO source_automation(resource_id,enabled,interval_minutes,max_items,publication_mode,content_mode,keywords) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(resource_id) DO UPDATE SET enabled=excluded.enabled,interval_minutes=excluded.interval_minutes,max_items=excluded.max_items,publication_mode=excluded.publication_mode,content_mode=excluded.content_mode,keywords=excluded.keywords,next_sync_at=now()`,[id,config.enabled,config.interval_minutes,config.max_items,config.publication_mode,config.content_mode,config.keywords]);
    await client.query('UPDATE source_automation SET daily_limit=$2 WHERE resource_id=$1',[id,config.daily_limit]);
   }
   await client.query('INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[user.id,'portal_resource.save','portal_resources',id,JSON.stringify({kind})]);
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  revalidatePath('/','layout');return {ok:true};
 }catch(error){return {error:error instanceof EditorialError?error.message:(error as {code?:string}).code==='42P01'?'La migración 009 debe aplicarse antes de guardar.':(error as {code?:string}).code==='23505'?'Esta URL ya está registrada.':'No se pudo guardar. Revisá los datos y la conexión.'};}
}
export async function syncResource(form:FormData){
 try{await operationsMutation();const id=uuid(text(form,'id',36,true));const result=await synchronizeSources(id);revalidatePath('/','layout');if(result.busy)return {ok:false,message:'Ya hay una sincronización en curso.'};const run=result.results[0];if(!run)return {ok:false,message:result.message||'Activá la fuente y guardá su configuración antes de sincronizar.'};return {ok:run.status!=='error',message:`Importadas: ${run.imported}. Duplicadas omitidas: ${run.duplicates}. Errores: ${run.errors}. ${run.message}`.trim()};}
 catch(error){return {ok:false,message:(error as {code?:string}).code==='42P01'?'Aplicá manualmente la migración 010 antes de sincronizar.':'No se pudo sincronizar la fuente.'};}
}
export async function configureInitialSources(form?:FormData){
 const user=await operationsMutation(),state=await automationData();
 const requested=form?.get('initial_source');
 const selected=requested?automaticSources.filter(s=>s.url===requested):initialSources;
 if(!selected.length)return {ok:false,message:'Fuente inicial inválida.'};
 const messages=[];
 for(const source of selected){
  try{
   const page=await retrySource(()=>source.feed?fetchRemoteFeed(source.feed,{allowGzip:isMediosPublicos(source.url)}):fetchRemotePage(source.url));
   if(!sourceEntries(page.html,source.url,Boolean(source.feed)).length)throw Error('Sin noticias verificables.');
   let category=(await getPool().query('SELECT id FROM categories WHERE slug=$1',[source.category])).rows[0];
   if(!category){const f=new FormData();f.set('name',source.category==='tecnologia'?'Tecnología':source.category==='mundo'?'Mundo':'Uruguay');f.set('slug',source.category);f.set('active','on');category={id:await saveTaxonomy('categories',f,user.id)};}
   const existing=(await getPool().query("SELECT id FROM portal_resources WHERE kind IN ('source','partner') AND url=$1",[source.url])).rows[0];
   const id=existing?.id||randomUUID();
   if(!existing)await getPool().query("INSERT INTO portal_resources(id,kind,name,url,description,feed_url,category_slug,active) VALUES($1,'source',$2,$3,$4,$5,$6,false)",[id,source.name,source.url,source.description,source.feed,source.category]);
   if(state.ready)await getPool().query("INSERT INTO source_automation(resource_id,keywords) VALUES($1,$2) ON CONFLICT DO NOTHING",[id,source.keywords]);
   await getPool().query("INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES($1,'source.configure','portal_resources',$2)",[user.id,id]);
   messages.push(source.name+(state.ready?': registrada (revisión, automatización desactivada).':': registrada. La automatización requiere activar la base de datos.'));
  }catch{messages.push(source.name+': no configurada; la fuente no pudo validarse.');}
 }
 revalidatePath('/','layout');return {ok:true,message:messages.join(' ')};
}
