import 'server-only';
import {randomUUID} from 'node:crypto';
import {getPool} from '@/lib/db/pool';
import {fetchRemoteFeed,fetchRemotePage} from '@/lib/security/remote-page.mjs';
import {sourceEntries,sourceUrl,canonicalArticle,eligibleEntry,retrySource,sourceSummary,articlePhotographs,sourceCategory} from '@/lib/editorial/source-sync.mjs';
import {sourceFeedUrls,interleaveSourceEntries,isMediosPublicos} from '@/lib/editorial/medios-publicos.mjs';
import {extractArticle} from '@/lib/editorial/import-article.mjs';
import {editorialPhoto} from '@/lib/editorial/cover-images.mjs';
import {importArticleImages} from '@/lib/editorial/import-images.mjs';
import {importEditorialImage} from './import-editorial-image';
import {saveNews,saveTaxonomy} from './editorial';
import {slugify} from '@/lib/editorial/shared';
import {importBudget,retentionPolicy} from './news-lifecycle';

export type Automation={resource_id:string;enabled:boolean;interval_minutes:number;max_items:number;daily_limit?:number;publication_mode:'review'|'automatic';content_mode:'summary'|'full';keywords:string;last_sync_at:Date|null;last_title:string;last_found_count:number;last_status:string;last_error:string;imported_count:number;duplicate_count:number};
type Source=Automation & {name:string;url:string;feed_url:string;category_slug:string};
export async function automationData(){
 try{return {ready:true,items:(await getPool().query<Automation>('SELECT * FROM source_automation')).rows};}
 catch(error){if((error as {code?:string}).code==='42P01')return {ready:false,items:[]};throw error;}
}
async function taxonomy(kind:'authors'|'categories',slug:string,name:string,user:string){
 const table=kind==='authors'?'authors':'categories';
 const row=(await getPool().query('SELECT id,active FROM '+table+' WHERE slug=$1',[slug])).rows[0];
 if(row){if(!row.active)throw Error('Autor o categoría inactivos: '+name);return row.id as string;}
 const form=new FormData();form.set('name',name);form.set('slug',slug);form.set('active','on');
 return saveTaxonomy(kind,form,user);
}
const safe=(value:string)=>value.replace(/[\\\[\]<>*_`]/g,'').trim();
async function importEntry(source:Source,entry:ReturnType<typeof sourceEntries>[number],user:string){
 const pool=getPool();
 const seen=await pool.query('SELECT 1 FROM source_news_items WHERE (resource_id=$1 AND source_identifier=$2) OR canonical_url=$3 UNION ALL SELECT 1 FROM news WHERE source_url=$3 OR canonical_url=$3 UNION ALL SELECT 1 FROM news_origin_tombstones WHERE canonical_url=$3 OR (resource_id=$1 AND source_identifier=$2) LIMIT 1',[source.resource_id,entry.id,entry.url]);
 if(seen.rowCount)return 'duplicate';
 let article,canonical=entry.url;
 try{
  const page=await retrySource(()=>fetchRemotePage(entry.url,{timeoutMs:8000,allowGzip:isMediosPublicos(source.url)}));
  sourceUrl(page.url,source.url);canonical=canonicalArticle(page.html,page.url,source.url);
  if(source.content_mode==='full'&&/"isAccessibleForFree"\s*:\s*(?:false|"false")/i.test(page.html))throw Error('La fuente no ofrece el artículo completo en acceso público. Usá resumen y enlace.');
  article=extractArticle(page.html,entry.url,page.url);
 }catch(error){
  // A public feed can legitimately provide a complete summary when its article is inaccessible.
  if(source.content_mode==='full'||!entry.summary||!entry.date)throw error;
  article={title:entry.title,subtitle:'',excerpt:entry.summary,body:'',original_published_at:entry.date,cover_candidates:[],external_images:[],external_image_url:entry.image,cover_alt:entry.title,cover_credit:'',cover_caption:'',warnings:[]};
 }
 if((await pool.query('SELECT 1 FROM source_news_items WHERE canonical_url=$1 UNION ALL SELECT 1 FROM news WHERE source_url=$1 OR canonical_url=$1 UNION ALL SELECT 1 FROM news_origin_tombstones WHERE canonical_url=$1 LIMIT 1',[canonical])).rowCount)return 'duplicate';
 const date=article.original_published_at||entry.date, time=Date.parse(date);
 const title=String(article.title||entry.title).trim();
 const summary=sourceSummary(article,entry),excerpt=summary.text;
 if(title.length<8||!excerpt||!Number.isFinite(time)||time>Date.now()||Date.now()-time>7*86400000)throw Error('Título, resumen o fecha de publicación incompletos.');
 const link='\n\n[Leé la información original en '+safe(source.name)+']('+canonical.replace(/\(/g,'%28').replace(/\)/g,'%29')+').' + (article.original_author?'\n\nAutoría original: '+safe(article.original_author)+'.':'');
 if(source.content_mode==='full'&&(!article.body||article.body.length<300||article.warnings?.length))throw Error('El cuerpo completo no pudo extraerse con calidad suficiente.');
 // Same extraction, safe downloads, image normalization and storage as the manual importer.
 const covers=[...articlePhotographs(article,source.url)];
 if(entry.image&&editorialPhoto(entry.image,source.url)&&!covers.some(c=>c.url===entry.image))covers.push({url:entry.image,alt:title,caption:'',credit:entry.credit||''});
 const prepared={...article,body:source.content_mode==='full'?article.body:safe(excerpt),external_image_url:covers[0]?.url||'',external_images:source.content_mode==='full'?article.external_images:[],cover_candidates:covers};
 const media=await importArticleImages(prepared,(url:string)=>importEditorialImage(url,user),{maxImages:source.content_mode==='full'?6:4,budgetMs:12000});
 if(!media.cover_image)throw Error('No se pudo guardar una fotografía de la noticia. Se intentará otra publicación: '+canonical);
 const incomplete=(source.content_mode==='full'&&media.warnings.length>0)||!summary.complete;
 const author=await taxonomy('authors','fuente-'+source.resource_id,source.name,user);
 const category=(await pool.query('SELECT id FROM categories WHERE slug=$1 AND active',[sourceCategory(source,entry)])).rows[0]?.id;
 if(!category)throw Error('Seleccioná una categoría activa para esta fuente.');
 const form=new FormData();
 for(const [key,value]of Object.entries({title:title.slice(0,240),slug:slugify(title).slice(0,150)+'-'+randomUUID().slice(0,8),subtitle:article.subtitle||'',excerpt,body:media.body+link,author_id:author,status:source.publication_mode==='automatic'&&!incomplete?'PUBLISHED':'DRAFT',published_at:new Date(time).toISOString(),source_name:source.name,source_url:canonical,canonical_url:canonical,cover_image:media.cover_image||'',cover_alt:media.cover_alt||title,cover_credit:media.cover_credit||'',cover_caption:media.cover_caption||'',imported:'1'}))form.set(key,String(value));
 form.set('category_ids',category);
 await saveNews(form,user,{resourceId:source.resource_id,identifier:entry.id});
 return incomplete&&source.publication_mode==='automatic'?'review':'imported';
}
// A lock-only transaction pins PgBouncer's backend throughout the bounded run.
// Business queries use the normal pool; rollback releases this lock on every exit.
// The new key replaces the former session-level lock, unsafe in transaction pooling.
export async function synchronizeSources(resourceId?:string){
 const pool=getPool(),lock=await pool.connect();let transaction=false;
 const results:{id:string;status:string;imported:number;duplicates:number;errors:number;message:string}[]=[];
 try{
  await lock.query('BEGIN');transaction=true;
  await lock.query("SET LOCAL idle_in_transaction_session_timeout='5min'");
  const locked=(await lock.query('SELECT pg_try_advisory_xact_lock(84201913) AS locked')).rows[0].locked;
  if(!locked)return {busy:true,results};
  const retention=await retentionPolicy();
  if(!retention.ready)return {busy:false,results,message:'La importación automática requiere activar la migración 011.'};
  const owner=(await pool.query("SELECT id FROM users WHERE role='OWNER' AND active AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1")).rows[0]?.id;
  if(!owner)throw Error('No hay un administrador activo para la sincronización.');
  const sources=(await pool.query<Source>(`SELECT a.*,r.name,r.url,r.feed_url,r.category_slug FROM source_automation a JOIN portal_resources r ON r.id=a.resource_id WHERE r.active AND r.kind IN ('partner','source') AND ${resourceId?'r.id=$1':'a.enabled AND a.next_sync_at<=now()'} ORDER BY a.next_sync_at,r.id LIMIT 20`,resourceId?[resourceId]:[])).rows;
  const deadline=Date.now()+220000;
  for(const source of sources){
   if(Date.now()>deadline)break;
   const interval=Math.max(source.interval_minutes||60,retention.policy.min_sync_minutes);
   if(source.last_sync_at&&Date.now()-new Date(source.last_sync_at).getTime()<interval*60000)continue;
   const budget=await importBudget(source.resource_id);
   if(budget.remaining<1)continue;
   const run=randomUUID(),result={id:source.resource_id,status:'ok',imported:0,duplicates:0,errors:0,message:''};
   await pool.query("UPDATE source_sync_runs SET status='interrupted',finished_at=now(),message='La ejecución anterior se interrumpió.' WHERE resource_id=$1 AND status='running'",[source.resource_id]);
   await pool.query("INSERT INTO source_sync_runs(id,resource_id) VALUES($1,$2)",[run,source.resource_id]);
   let lastTitle='',found=0;
   try{
    const feeds=sourceFeedUrls(source);
    const groups=feeds.length?await Promise.all(feeds.map(async url=>{const page=await retrySource(()=>fetchRemoteFeed(url,{timeoutMs:8000,allowGzip:isMediosPublicos(source.url)}));return sourceEntries(page.html,source.url,true);})):[];
    const discovered=feeds.length>1?interleaveSourceEntries(groups):feeds.length?groups[0]:sourceEntries((await retrySource(()=>fetchRemotePage(source.url,{timeoutMs:8000}))).html,source.url,false);found=discovered.length;
    const entries=discovered.filter(e=>eligibleEntry(e,source.keywords)&&sourceCategory(source,e));
    if(!entries.length)result.message='Sin publicaciones elegibles en esta consulta.';
    lastTitle=entries[0]?.title||'';
    let attempts=0;
    for(const entry of entries){
     if(result.imported>=Math.min(source.max_items,budget.remaining)||attempts>=source.max_items+5||Date.now()>deadline)break;
     try{const outcome=await importEntry(source,entry,owner);if(outcome==='duplicate')result.duplicates++;else {result.imported++;attempts++;if(outcome==='review')result.message='La noticia se envió a revisión porque la extracción requiere una comprobación editorial.';}}
     catch(error){attempts++;result.errors++;result.message=error instanceof Error?error.message:'No se pudo importar la publicación.';await pool.query("INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES($1,'source.item_failed','portal_resources',$2,$3)",[owner,source.resource_id,JSON.stringify({runId:run,url:entry.url,message:result.message.slice(0,500)})]);}
    }
    if(result.errors)result.status=result.imported?'partial':'error';
   }catch(error){result.status='error';result.errors++;result.message=error instanceof Error?error.message:'Fuente indisponible.';}
   result.message=result.message.slice(0,500);
   await pool.query(`UPDATE source_automation SET last_sync_at=now(),next_sync_at=now()+$8*interval '1 minute',last_title=$2,last_status=$3,last_error=$4,imported_count=imported_count+$5,duplicate_count=duplicate_count+$6,last_found_count=$7 WHERE resource_id=$1`,[source.resource_id,lastTitle,result.status,result.message,result.imported,result.duplicates,found,interval]);
   await pool.query('UPDATE source_sync_runs SET finished_at=now(),status=$2,imported=$3,duplicates=$4,errors=$5,message=$6 WHERE id=$1',[run,result.status,result.imported,result.duplicates,result.errors,result.message]);
   console.info('source.sync',JSON.stringify(result));results.push(result);
  }
  return {busy:false,results,message:results.length?'':'Sin importaciones: revisá el intervalo mínimo, los límites diarios y las fuentes activas.'};
 }finally{let discard=false;if(transaction)await lock.query('ROLLBACK').catch(()=>{discard=true;});lock.release(discard);}
}
