import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db/pool';
import { renderedImagePaths } from '@/lib/editorial/content.mjs';
import { retentionDefaults, remainingImports, publicationWindow, canManageNews, managedMediaProof, managedImagePattern } from '@/lib/editorial/retention.mjs';
import { statR2, discardR2 } from './r2-storage.mjs';

type DB = Pick<PoolClient,'query'>;
const expirable=`l.retention_managed AND NOT l.permanent AND NOT l.editorial_protected AND NOT n.featured
 AND n.id::text<>COALESCE((SELECT value FROM settings WHERE key='HOME_LEAD_NEWS_ID'),'')`;
export type RetentionPolicy = typeof retentionDefaults & {prospective_from?:Date|string};
export async function retentionPolicy(db:DB=getPool()):Promise<{ready:boolean;policy:RetentionPolicy}> {
 const ready=(await db.query("SELECT to_regclass('public.news_retention_policy') IS NOT NULL AS ready")).rows[0]?.ready;
 if(!ready)return {ready:false,policy:{...retentionDefaults}};
 const policy=(await db.query('SELECT * FROM news_retention_policy WHERE id=true')).rows[0];
 return {ready:true,policy:{...policy,publication_hours:retentionDefaults.publication_hours}};
}
export async function importBudget(resourceId:string,db:DB=getPool()) {
 const state=await retentionPolicy(db);
 if(!state.ready)return {...state,remaining:0};
 const result=(await db.query(`SELECT
 (SELECT count(*)::int FROM source_news_items WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'America/Montevideo') AT TIME ZONE 'America/Montevideo') AS global,
 (SELECT count(*)::int FROM source_news_items WHERE resource_id=$1 AND created_at>=date_trunc('day',now() AT TIME ZONE 'America/Montevideo') AT TIME ZONE 'America/Montevideo') AS source,
 (SELECT count(DISTINCT n.id)::int FROM news n JOIN source_news_items si ON si.news_id=n.id LEFT JOIN news_lifecycle l ON l.news_id=n.id
 WHERE n.status<>'ARCHIVED' AND l.trashed_at IS NULL AND (l.expires_at IS NULL OR l.permanent OR l.expires_at>now())) AS active,
 (SELECT daily_limit FROM source_automation WHERE resource_id=$1) AS daily_limit`,[resourceId])).rows[0];
 return {...state,remaining:remainingImports(state.policy,result,result.daily_limit??5)};
}
export async function registerNewsRetention(db:DB,id:string,status:string,scheduled:string|null,policy:RetentionPolicy,automatic=false,published:string|null=null) {
 if(!policy.prospective_from)return;
 const starts=status==='PUBLISHED'?new Date(published||Date.now()):status==='SCHEDULED'&&scheduled?new Date(scheduled):null;
 // Do not enroll backdated publications, old rows, or legacy articles on edit.
 if(starts&&starts<new Date(policy.prospective_from))return;
 const window=starts?publicationWindow(starts,retentionDefaults.publication_hours,policy.recovery_days):null;
 await db.query(`INSERT INTO news_lifecycle(news_id,automatic,publication_hours,recovery_days,first_published_at,expires_at,purge_after,retention_managed)
 VALUES($1,$7,$2,$3,$4,$5,$6,true) ON CONFLICT(news_id) DO NOTHING`,[id,retentionDefaults.publication_hours,policy.recovery_days,window?.first||null,window?.expires||null,window?.purge||null,automatic]);
}
export async function registerAutomaticNews(db:DB,id:string,status:string,scheduled:string|null,policy:RetentionPolicy,published:string|null=null) {
 return registerNewsRetention(db,id,status,scheduled,policy,true,published);
}
export async function editorialLifecycle(db:DB,id:string,status:string,scheduled:string|null,published:string|null=null) {
 // Never enroll legacy rows during an edit; manual and automatic new drafts share the window.
 const state=await retentionPolicy(db);if(!state.ready)return;
 const item=(await db.query('SELECT * FROM news_lifecycle WHERE news_id=$1 FOR UPDATE',[id])).rows[0];
 if(!item)return;
 if(item.trashed_at)throw Error('Restaurá la noticia desde Papelera antes de editar.');
 let window=null;
 const pendingPublication=item.retention_managed&&(!item.first_published_at||new Date(item.first_published_at)>new Date());
 if(pendingPublication&&(status==='PUBLISHED'||status==='SCHEDULED')){
  const starts=status==='SCHEDULED'&&scheduled?new Date(scheduled):new Date(published||Date.now());
  if(state.policy.prospective_from&&starts<new Date(state.policy.prospective_from)){
   await db.query('UPDATE news_lifecycle SET retention_managed=false WHERE news_id=$1',[id]);return;
  }
  window=publicationWindow(starts,retentionDefaults.publication_hours,item.recovery_days);
 }
 await db.query(`UPDATE news_lifecycle SET editorial_protected=editorial_protected OR automatic,
 first_published_at=CASE WHEN $5 THEN $2 ELSE first_published_at END,expires_at=CASE WHEN $5 THEN $3 ELSE expires_at END,purge_after=CASE WHEN $5 THEN $4 ELSE purge_after END,updated_at=now() WHERE news_id=$1`,[id,window?.first||null,window?.expires||null,window?.purge||null,pendingPublication]);
}
async function audit(db:DB,user:string|null,action:string,id:string,metadata:object={}) {
 await db.query('INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES($1,$2,\'news\',$3,$4)',[user,action,id,JSON.stringify(metadata)]);
}
// SQL expressions below are internal constants, never user-supplied identifiers.
function mediaReferences(path='$1',excluding='$2') { return `
 SELECT 1 FROM news WHERE NOT(id=ANY(${excluding}::uuid[])) AND (cover_image=${path} OR strpos(body,${path})>0)
 UNION ALL SELECT 1 FROM authors WHERE strpos(photo_url,${path})>0
 UNION ALL SELECT 1 FROM presenters WHERE strpos(photo_url,${path})>0
 UNION ALL SELECT 1 FROM programs WHERE strpos(cover_image,${path})>0
 UNION ALL SELECT 1 FROM videos WHERE strpos(thumbnail_url,${path})>0
 UNION ALL SELECT 1 FROM ad_campaigns WHERE strpos(image_url,${path})>0 OR strpos(mobile_image_url,${path})>0
 UNION ALL SELECT 1 FROM portal_resources WHERE strpos(image_url,${path})>0
 UNION ALL SELECT 1 FROM settings WHERE strpos(replace(value,'\\/','/'),${path})>0`; }
async function mediaReferenced(db:DB,path:string,excluding:string[]=[]):Promise<boolean> {
 const row=(await db.query(`SELECT EXISTS (${mediaReferences()}) AS used`,[path,excluding])).rows[0];
 return Boolean(row.used);
}
async function mediaOwnership(db:DB,path:string,lock=false) {
 const asset=(await db.query(`SELECT * FROM media_assets WHERE path=$1 ${lock?'FOR UPDATE':''}`,[path])).rows[0];
 if(!asset)return null;
 const proof=(await db.query("SELECT metadata FROM audit_log WHERE entity='media_assets' AND entity_id=$1 AND action='media.upload' ORDER BY id DESC LIMIT 1",[asset.id])).rows[0]?.metadata;
 return managedMediaProof(asset,proof)?asset:null;
}
function imagePaths(news:{body:string;cover_image:string}) {
 return [...new Set([news.cover_image,...renderedImagePaths(news.body)])].filter(path=>managedImagePattern.test(path));
}
async function removeNews(db:DB,news:{id:string;body:string;cover_image:string},user:string|null) {
 // Tombstones persist even if source_news_items later loses its resource FK.
 await db.query(`INSERT INTO news_origin_tombstones(canonical_url,resource_id,source_identifier)
 SELECT canonical_url,resource_id,source_identifier FROM source_news_items WHERE news_id=$1 ON CONFLICT DO NOTHING`,[news.id]);
 await db.query(`INSERT INTO news_origin_tombstones(canonical_url,source_identifier)
 SELECT origin,origin FROM news n CROSS JOIN LATERAL (VALUES(n.source_url),(n.canonical_url)) urls(origin)
 WHERE n.id=$1 AND origin LIKE 'http%' ON CONFLICT DO NOTHING`,[news.id]);
 for(const path of imagePaths(news))if(await mediaOwnership(db,path))await db.query('INSERT INTO news_media_cleanup(path,object_key) VALUES($1,$2) ON CONFLICT DO NOTHING',[path,path.slice(1)]);
 await audit(db,user,'news.purge',news.id);
 // The DB cascades categories/lifecycle; source_news_items retains its unique identity with news_id NULL.
 await db.query('DELETE FROM news WHERE id=$1',[news.id]);
}
export async function manageNewsLifecycle(id:string,operation:string,actor:{id:string;role:string}) {
 if(!canManageNews(actor.role,operation))throw Error('No tenés permiso para esta operación.');
 if(!['trash','restore','purge','permanent','unprotect'].includes(operation))throw Error('Operación inválida.');
 const db=await getPool().connect();
 try{
  await db.query('BEGIN');
  const state=await retentionPolicy(db);if(!state.ready)throw Error('La gestión requiere activar la migración 011.');
  const news=(await db.query('SELECT * FROM news WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!news)throw Error('Noticia no encontrada.');
  await db.query('INSERT INTO news_lifecycle(news_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
  const item=(await db.query('SELECT * FROM news_lifecycle WHERE news_id=$1 FOR UPDATE',[id])).rows[0];
  if(operation==='trash'){
   if(!item.trashed_at){await db.query("UPDATE news_lifecycle SET trashed_at=now(),trash_reason='manual',purge_after=now()+$2*interval '1 day',updated_at=now() WHERE news_id=$1",[id,state.policy.recovery_days]);await db.query("UPDATE news SET status='ARCHIVED',updated_at=now(),version=version+1 WHERE id=$1",[id]);}
  }else if(operation==='restore'){
   if(item.trashed_at||(item.retention_managed&&!item.permanent&&item.expires_at&&new Date(item.expires_at)<=new Date())){
    await db.query('UPDATE news_lifecycle SET trashed_at=NULL,trash_reason=NULL,purge_after=NULL,permanent=automatic OR permanent OR EXISTS(SELECT 1 FROM source_news_items WHERE news_id=$1),editorial_protected=true,updated_at=now() WHERE news_id=$1',[id]);
    await db.query("UPDATE news SET status='DRAFT',updated_at=now(),version=version+1 WHERE id=$1",[id]);
   }
  }else if(operation==='permanent'){
   // Toggling protection never changes publication dates or enrolls legacy news.
   await db.query('UPDATE news_lifecycle SET permanent=NOT permanent,updated_at=now() WHERE news_id=$1',[id]);
  }else if(operation==='unprotect')await db.query('UPDATE news_lifecycle SET editorial_protected=false,updated_at=now() WHERE news_id=$1',[id]);
  else{
   if(!item.trashed_at)throw Error('Enviá la noticia a Papelera antes de eliminarla definitivamente.');
   if(item.permanent||item.editorial_protected)throw Error('La noticia está protegida. Retirá la protección antes de eliminarla.');
   await removeNews(db,news,actor.id);
  }
  if(operation!=='purge')await audit(db,actor.id,'news.'+operation,id);
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
export async function lifecycleDashboard() {
 const state=await retentionPolicy();if(!state.ready||!state.policy.prospective_from)return {...state,counts:null,runs:[]};
 const counts=(await getPool().query(`SELECT
 (SELECT count(DISTINCT an.id)::int FROM news an JOIN source_news_items si ON si.news_id=an.id LEFT JOIN news_lifecycle al ON al.news_id=an.id WHERE an.status<>'ARCHIVED' AND al.trashed_at IS NULL AND (al.permanent OR al.expires_at IS NULL OR al.expires_at>now())) AS active,
 count(*) FILTER(WHERE ${expirable} AND l.expires_at<=now())::int AS expired,
 count(*) FILTER(WHERE ${expirable} AND l.purge_after<=now() AND l.trash_reason='expired' AND l.trashed_at IS NOT NULL)::int AS pending,
 count(*) FILTER(WHERE l.permanent)::int AS permanent,
 (SELECT count(*)::int FROM source_news_items si JOIN news old ON old.id=si.news_id LEFT JOIN news_lifecycle ol ON ol.news_id=old.id WHERE ol.news_id IS NULL) AS legacy
 FROM news_lifecycle l JOIN news n ON n.id=l.news_id`)).rows[0];
 const runs=(await getPool().query('SELECT * FROM news_cleanup_runs ORDER BY started_at DESC LIMIT 10')).rows;
 return {...state,counts,runs};
}
export async function trashNews(page=1) {
 const state=await retentionPolicy();if(!state.ready||!state.policy.prospective_from)return {...state,items:[],pages:1,page:1};
 const where=`l.trashed_at IS NOT NULL OR (${expirable} AND l.expires_at<=now())`;
 const total=Number((await getPool().query(`SELECT count(*) FROM news_lifecycle l JOIN news n ON n.id=l.news_id WHERE ${where}`)).rows[0].count),pages=Math.max(1,Math.ceil(total/50));
 page=Math.max(1,Math.min(pages,Number.isFinite(page)?Math.floor(page):1));
 const items=(await getPool().query(`SELECT n.id,n.title,n.updated_at,l.* FROM news n JOIN news_lifecycle l ON l.news_id=n.id
 WHERE ${where} ORDER BY COALESCE(l.trashed_at,l.expires_at) DESC,n.id LIMIT 50 OFFSET $1`,[(page-1)*50])).rows;
 return {...state,items,pages,page};
}
export async function newsLifecycle(id:string) {
 if(!(await retentionPolicy()).ready)return null;
 return (await getPool().query('SELECT * FROM news_lifecycle WHERE news_id=$1',[id])).rows[0]||null;
}

export async function runNewsRetention({dryRun=true,task='all'}:{dryRun?:boolean;task?:'all'|'expire'|'cleanup'}={}) {
 const state=await retentionPolicy();if(!state.ready||!state.policy.prospective_from)return {ready:false,busy:false,dryRun,expired:0,removed:0,images:0,errors:0,message:'Activá las migraciones 011 y 012 (15 días).'};
 const db=await getPool().connect(),run=randomUUID();let transaction=false;
 const deadline=Date.now()+45000;
 const result={ready:true,busy:false,dryRun,expired:0,removed:0,images:0,errors:0,message:''};
 const previewImages=new Set<string>(),previewNews:string[]=[];
 try{
  await db.query(dryRun?'BEGIN READ ONLY':'BEGIN');transaction=true;
  const locked=(await db.query('SELECT pg_try_advisory_xact_lock(84201915) AS locked')).rows[0].locked;
  if(!locked)return {...result,busy:true};
  if(!dryRun)await db.query('INSERT INTO news_cleanup_runs(id,dry_run) VALUES($1,false)',[run]);
  const expired=(await db.query(`SELECT n.id FROM news n JOIN news_lifecycle l ON l.news_id=n.id WHERE ${expirable} AND l.trashed_at IS NULL AND l.expires_at<=now() ORDER BY l.expires_at LIMIT 500`)).rows;
  if(task!=='cleanup'){
   if(dryRun)result.expired=expired.length;
   if(!dryRun)for(const item of expired){
    if(Date.now()>deadline)break;
    await db.query('SAVEPOINT expiry_item');
    try{
     await db.query('SELECT id FROM news WHERE id=$1 FOR UPDATE',[item.id]);
     const eligible=(await db.query(`SELECT n.id FROM news n JOIN news_lifecycle l ON l.news_id=n.id WHERE n.id=$1 AND ${expirable} AND l.trashed_at IS NULL AND l.expires_at<=now() FOR UPDATE OF l`,[item.id])).rowCount;
     if(!eligible){await db.query('RELEASE SAVEPOINT expiry_item');continue;}
     const updated=await db.query("UPDATE news_lifecycle SET trashed_at=now(),trash_reason='expired',purge_after=now()+recovery_days*interval '1 day',updated_at=now() WHERE news_id=$1 AND retention_managed AND NOT permanent AND NOT editorial_protected AND trashed_at IS NULL AND expires_at<=now() RETURNING news_id",[item.id]);
     if(updated.rowCount){await db.query("UPDATE news SET status='ARCHIVED',version=version+1,updated_at=now() WHERE id=$1",[item.id]);await audit(db,null,'news.expire',item.id);result.expired++;}
     await db.query('RELEASE SAVEPOINT expiry_item');
    }catch{await db.query('ROLLBACK TO SAVEPOINT expiry_item');result.errors++;await audit(db,null,'news.expire_failed',item.id);}
   }
  }
  if(task!=='expire'){
   const candidates=(await db.query(`SELECT n.*,l.news_id FROM news n JOIN news_lifecycle l ON l.news_id=n.id
    WHERE ${expirable} AND l.purge_after<=now()
    AND l.trash_reason='expired' AND l.trashed_at IS NOT NULL ORDER BY l.purge_after LIMIT 100`)).rows;
   if(dryRun){
    result.removed=candidates.length;
    const excluded=candidates.map(n=>n.id),paths=[...new Set(candidates.flatMap(imagePaths))];
    previewNews.push(...excluded);
    for(const path of paths)if(await mediaOwnership(db,path)&&!await mediaReferenced(db,path,excluded))previewImages.add(path);
   }else if(state.policy.cleanup_enabled){
    for(const candidate of candidates){
     if(Date.now()>deadline)break;
     await db.query('SAVEPOINT purge_item');
     try{
      const news=(await db.query('SELECT * FROM news WHERE id=$1 FOR UPDATE',[candidate.id])).rows[0];
      const eligible=(await db.query(`SELECT l.news_id FROM news_lifecycle l JOIN news n ON n.id=l.news_id WHERE l.news_id=$1 AND ${expirable} AND l.trash_reason='expired' AND l.trashed_at IS NOT NULL AND l.purge_after<=now() FOR UPDATE OF l`,[candidate.id])).rowCount;
      if(news&&eligible){await removeNews(db,news,null);result.removed++;}
      await db.query('RELEASE SAVEPOINT purge_item');
     }catch{await db.query('ROLLBACK TO SAVEPOINT purge_item');result.errors++;await audit(db,null,'news.purge_failed',candidate.id);}
    }
   }else result.message='Limpieza definitiva desactivada; la expiración sigue funcionando.';
  }
  // Bounded prospective orphan sweep, with positive manual/imported R2 ownership proof.
  if(task!=='expire'&&(dryRun||state.policy.cleanup_enabled)){
   const orphans=(await db.query(`SELECT m.path FROM media_assets m WHERE m.mime_type='image/webp' AND m.created_at<now()-$1*interval '1 day'
    AND m.created_at>=(SELECT prospective_from FROM news_retention_policy WHERE id=true)
    AND EXISTS (SELECT 1 FROM audit_log a WHERE a.entity='media_assets' AND a.action='media.upload' AND a.entity_id=m.id::text AND a.metadata->>'storageProvider'='r2' AND a.metadata->>'sourceType' IN ('import','manual') AND a.metadata->>'objectKey'=substring(m.path FROM 2))
    AND NOT EXISTS (${mediaReferences('m.path',"'{}'")}) ORDER BY m.created_at LIMIT 100`,[state.policy.recovery_days])).rows;
   for(const {path}of orphans){
    if(Date.now()>deadline)break;
    if(!await mediaOwnership(db,path)||await mediaReferenced(db,path))continue;
    if(dryRun)previewImages.add(path);
    else await db.query('INSERT INTO news_media_cleanup(path,object_key) VALUES($1,$2) ON CONFLICT DO NOTHING',[path,path.slice(1)]);
   }
  }
  if(dryRun){
   if(task!=='expire')for(const {path}of (await db.query('SELECT path FROM news_media_cleanup WHERE next_attempt_at<=now() AND queued_at>=(SELECT prospective_from FROM news_retention_policy WHERE id=true) ORDER BY queued_at LIMIT 100')).rows){
    if(Date.now()>deadline)break;
    if(await mediaOwnership(db,path)&&!await mediaReferenced(db,path,previewNews))previewImages.add(path);
   }
   result.images=previewImages.size;
   result.message='Simulación por lote. La limpieza real requiere habilitación explícita.';
  }
  await db.query('COMMIT');transaction=false;
  // Separate object cleanup: commit article changes first; retain retry queue on any R2 failure.
  if(!dryRun&&task!=='expire'&&state.policy.cleanup_enabled){
   const pending=(await getPool().query('SELECT path FROM news_media_cleanup WHERE next_attempt_at<=now() AND queued_at>=(SELECT prospective_from FROM news_retention_policy WHERE id=true) ORDER BY queued_at LIMIT 100')).rows;
   for(const {path}of pending){
    if(Date.now()>deadline)break;
    const media=await getPool().connect();
    try{
     await media.query('BEGIN');
     const entry=(await media.query('SELECT * FROM news_media_cleanup WHERE path=$1 FOR UPDATE SKIP LOCKED',[path])).rows[0];
     if(!entry){await media.query('ROLLBACK');continue;}
     const asset=await mediaOwnership(media,path,true);
     if(!asset||await mediaReferenced(media,path)){
      // Shared or unproven media are preserved; future deletion can enqueue them again.
      await media.query('DELETE FROM news_media_cleanup WHERE path=$1',[path]);await media.query('COMMIT');continue;
     }
     const object=await statR2(entry.object_key,{signal:AbortSignal.timeout(5000)});
     if(object&&(object.size!==asset.size||object.mimeType!==asset.mime_type))throw Error('Objeto distinto al archivo registrado.');
     if(object)await discardR2(entry.object_key,{signal:AbortSignal.timeout(5000)});
     await media.query('DELETE FROM media_assets WHERE path=$1',[path]);
     await media.query('DELETE FROM news_media_cleanup WHERE path=$1',[path]);
     await audit(media,null,'news.media_cleanup',asset.id,{path});
     await media.query('COMMIT');result.images++;
    }catch{
     await media.query('ROLLBACK');result.errors++;
     await getPool().query("UPDATE news_media_cleanup SET attempts=attempts+1,last_error='No se pudo verificar o eliminar la imagen; se reintentará.',next_attempt_at=now()+interval '1 hour' WHERE path=$1",[path]);
    }finally{media.release();}
   }
  }
  if(!dryRun)await getPool().query('UPDATE news_cleanup_runs SET finished_at=now(),expired=$2,removed=$3,images_removed=$4,errors=$5,summary=$6 WHERE id=$1',[run,result.expired,result.removed,result.images,result.errors,result.message]);
  return result;
 }catch(error){if(transaction)await db.query('ROLLBACK');throw error;}finally{db.release();}
}
