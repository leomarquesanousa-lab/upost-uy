import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {retentionDefaults,retentionInput,remainingImports,publicationWindow,canPurge,canManageNews,managedMediaProof} from '../lib/editorial/retention.mjs';
const stub=code=>({url:'data:text/javascript,'+encodeURIComponent(code),shortCircuit:true});
registerHooks({resolve(s,c,next){
 if(s==='server-only')return stub('export {}');
 if(s==='@/lib/db/pool')return stub('export function getPool(){return globalThis.retentionTest.pool}');
 if(s==='@/server/services/source-automation')return stub('export async function synchronizeSources(){globalThis.retentionTest.synchronizations=(globalThis.retentionTest.synchronizations||0)+1;return {results:[]}}');
 if(s==='./r2-storage.mjs'&&c.parentURL?.endsWith('/news-lifecycle.ts'))return stub('export async function statR2(){globalThis.retentionTest.heads++;return {size:100,mimeType:"image/webp"}} export async function discardR2(){if(globalThis.retentionTest.failR2)throw Error("unavailable");globalThis.retentionTest.deletedObjects++}');
 if(s.startsWith('@/')||(s.startsWith('.')&&!c.parentURL?.includes('/node_modules/'))){const base=s.startsWith('@/')?new URL('../'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of['','.ts','.mjs']){const u=new URL(base.href+ext);if(existsSync(u))return next(u.href,c);}}
 return next(s,c);
}});
const {manageNewsLifecycle,runNewsRetention,importBudget,registerAutomaticNews,registerNewsRetention,editorialLifecycle}=await import('../server/services/news-lifecycle.ts');
const id='00000000-0000-4000-8000-000000000001',image='/media/'+id+'.webp';
const actor={id,role:'ADMIN'};
function setup(options={}){
 const state={ready:true,policy:{...retentionDefaults,prospective_from:new Date('2026-01-01'),cleanup_enabled:true},counts:{global:0,source:0,active:0,daily_limit:5},news:{id,body:'Texto',cover_image:image,status:'PUBLISHED'},life:{news_id:id,retention_managed:true,publication_hours:360,recovery_days:7,automatic:true,permanent:false,editorial_protected:false,first_published_at:new Date(Date.now()-23*86400000),expires_at:new Date(Date.now()-8*86400000),trashed_at:null,purge_after:new Date(Date.now()-1000),trash_reason:null},asset:{id,path:image,size:100,mime_type:'image/webp'},proof:{storageProvider:'r2',objectKey:image.slice(1),sourceType:'import'},queue:false,tombstone:false,heads:0,deletedObjects:0,statements:[],...options};
 const eligible=()=>state.news&&state.life.retention_managed&&!state.life.permanent&&!state.life.editorial_protected&&!state.news.featured&&!state.news.home_lead;
 const query=async(sql,v=[])=>{
  state.statements.push(sql);
  state.calls||=[];state.calls.push({sql,values:v});
  if(sql.includes('to_regclass'))return{rows:[{ready:state.ready}]};
  if(sql==='SELECT * FROM news_retention_policy WHERE id=true')return{rows:[state.policy]};
  if(sql.includes(' AS global,'))return{rows:[state.counts]};
  if(sql.includes('pg_try_advisory_xact_lock'))return{rows:[{locked:!state.busy}]};
  if(sql==='SELECT * FROM news WHERE id=$1 FOR UPDATE')return{rows:state.news?[state.news]:[]};
  if(sql==='SELECT * FROM news_lifecycle WHERE news_id=$1 FOR UPDATE')return{rows:[state.life]};
  if(sql.includes('SELECT n.id FROM news n JOIN news_lifecycle')){const found=eligible()&&!state.life.trashed_at&&new Date(state.life.expires_at)<=new Date();return{rows:found?[{id}]:[],rowCount:found?1:0};}
  if(sql.includes('SELECT n.*,l.news_id'))return{rows:eligible()&&state.life.trashed_at&&state.life.trash_reason==='expired'&&new Date(state.life.purge_after)<=new Date()?[state.news]:[]};
  if(sql.startsWith('SELECT l.news_id FROM news_lifecycle'))return{rows:[state.life],rowCount:eligible()&&state.life.trash_reason==='expired'?1:0};
  if(sql.startsWith("UPDATE news_lifecycle SET trashed_at=now(),trash_reason='expired'")){state.life.trashed_at=new Date();state.life.trash_reason='expired';state.life.purge_after=new Date(Date.now()+state.life.recovery_days*86400000);return{rows:[{news_id:id}],rowCount:1};}
  if(sql.startsWith('UPDATE news_lifecycle SET trashed_at=now()')){state.life.trashed_at=new Date();state.life.trash_reason='manual';}
  if(sql.startsWith('UPDATE news_lifecycle SET trashed_at=NULL')){state.life.trashed_at=null;state.life.permanent=state.life.automatic;state.life.editorial_protected=true;}
  if(sql.includes("SET status='ARCHIVED'"))state.news.status='ARCHIVED';
  if(sql.includes("SET status='DRAFT'"))state.news.status='DRAFT';
  if(sql.startsWith('UPDATE news_lifecycle SET editorial_protected=editorial_protected'))state.life.editorial_protected=true;
  if(sql.startsWith('SELECT * FROM media_assets'))return{rows:state.asset?[state.asset]:[]};
  if(sql.startsWith('SELECT metadata FROM audit_log'))return{rows:[{metadata:state.proof}]};
  if(sql.includes(' AS used'))return{rows:[{used:Boolean(state.shared||state.news&&!v[1]?.includes(id))}]};
  if(sql.startsWith('SELECT path FROM media_assets'))return{rows:[]};
  if(sql.startsWith('INSERT INTO news_media_cleanup'))state.queue=true;
  if(sql.startsWith('SELECT path FROM news_media_cleanup'))return{rows:state.queue?[{path:image}]:[]};
  if(sql.startsWith('SELECT * FROM news_media_cleanup'))return{rows:state.queue?[{path:image,object_key:image.slice(1)}]:[]};
  if(sql.startsWith('INSERT INTO news_origin_tombstones'))state.tombstone=true;
  if(sql.startsWith('DELETE FROM news WHERE'))state.news=null;
  if(sql.startsWith('DELETE FROM news_media_cleanup'))state.queue=false;
  if(sql.startsWith('DELETE FROM media_assets'))state.asset=null;
  if(sql.startsWith('UPDATE news_media_cleanup'))state.retry=true;
  return{rows:[],rowCount:1};
 };
 const client={query,release(){}};state.pool={query,connect:async()=>client};globalThis.retentionTest=state;return state;
}
test('initial limits, daily caps, active cap and input validation',async()=>{
 assert.equal(retentionDefaults.global_daily_limit,20);assert.equal(retentionDefaults.publication_hours,360);assert.equal(retentionDefaults.recovery_days,7);assert.equal(retentionDefaults.min_sync_minutes,60);assert.equal(retentionDefaults.active_limit,500);
 const s=setup();assert.equal((await importBudget(id)).remaining,5);
 s.counts.source=5;assert.equal((await importBudget(id)).remaining,0);
 s.counts.source=0;s.counts.global=20;assert.equal((await importBudget(id)).remaining,0);
 s.counts.global=0;s.counts.active=500;assert.equal((await importBudget(id)).remaining,0);
 assert.equal(remainingImports(retentionDefaults,{global:19,source:4,active:499},5),1);
 const form=new FormData();for(const[k,v]of Object.entries(retentionDefaults))form.set(k,String(v));assert.equal(retentionInput(form).global_daily_limit,20);form.set('min_sync_minutes','30');assert.throws(()=>retentionInput(form));
 assert.match(s.statements.find(q=>q.includes(' AS global,')),/America\/Montevideo/);
});
test('expiry is exactly 15 complete days from publication for automatic and manual news',async()=>{
 const start=new Date('2026-11-01T12:34:56Z'),w=publicationWindow(start);assert.equal(w.expires.getTime()-start.getTime(),15*86400000);assert.equal(w.purge.getTime()-w.expires.getTime(),7*86400000);
 const s=setup();await registerAutomaticNews(s.pool,id,'DRAFT',null,s.policy);assert.match(s.statements.at(-1),/first_published_at,expires_at,purge_after/);assert.equal(s.calls.at(-1).values[3],null);
 for(const automatic of [true,false]){await registerNewsRetention(s.pool,id,'PUBLISHED',null,s.policy,automatic,start.toISOString());const values=s.calls.at(-1).values;assert.equal(values[3].toISOString(),start.toISOString());assert.equal(values[4]-values[3],15*86400000);assert.equal(values[6],automatic);}
});
test('rescheduling before first publication updates the window, while edits after publication never extend it',async()=>{
 const s=setup();s.life.first_published_at=new Date(Date.now()+3600000);const scheduled=new Date(Date.now()+86400000).toISOString();await editorialLifecycle(s.pool,id,'SCHEDULED',scheduled);const call=s.calls.at(-1);assert.equal(call.values[1].toISOString(),scheduled);assert.equal(call.values[2]-call.values[1],15*86400000);assert.equal(call.values[4],true);
 s.life.first_published_at=new Date(Date.now()-3600000);await editorialLifecycle(s.pool,id,'PUBLISHED',null);assert.equal(s.calls.at(-1).values[4],false);
});
test('legacy, pinned, permanent and protected news never expire or purge',async()=>{
 const base={retention_managed:true,automatic:false,permanent:false,editorial_protected:false,trashed_at:new Date(),trash_reason:'expired',purge_after:new Date(0)};
 assert.equal(canPurge(base),true);for(const item of [{...base,retention_managed:false},{...base,featured:true},{...base,home_lead:true},{...base,permanent:true},{...base,editorial_protected:true},{...base,trash_reason:'manual'}])assert.equal(canPurge(item),false);
 for(const life of [{retention_managed:false},{permanent:true},{editorial_protected:true}]){const s=setup();Object.assign(s.life,life);const r=await runNewsRetention({dryRun:false});assert.equal(r.expired,0);assert.ok(s.news);assert.equal(s.deletedObjects,0);}
 for(const flag of ['featured','home_lead']){const s=setup();s.news[flag]=true;const r=await runNewsRetention({dryRun:false});assert.equal(r.expired,0);assert.ok(s.news);assert.equal(s.deletedObjects,0);}
});
test('trash, restore to protected draft, confirmations represented by authorized server operations',async()=>{
 const s=setup();await manageNewsLifecycle(id,'trash',actor);assert.equal(s.news.status,'ARCHIVED');assert.equal(s.life.trash_reason,'manual');await manageNewsLifecycle(id,'restore',actor);assert.equal(s.news.status,'DRAFT');assert.equal(s.life.permanent,true);assert.equal(s.life.editorial_protected,true);assert.equal(s.deletedObjects,0);
});
test('server forbids permanent deletion by editors and protected deletion even for admins',async()=>{
 setup();await assert.rejects(manageNewsLifecycle(id,'purge',{id,role:'EDITOR'}),/permiso/);assert.equal(canManageNews('EDITOR','restore'),true);assert.equal(canManageNews('EDITOR','unprotect'),false);assert.equal(canManageNews('ADMIN','purge'),true);
 const s=setup();s.life.trashed_at=new Date();s.life.permanent=true;await assert.rejects(manageNewsLifecycle(id,'purge',actor),/protegida/);
});
test('dry-run is read-only, previews counts and never reaches R2 writes',async()=>{
 const s=setup();let r=await runNewsRetention();assert.equal(r.expired,1);assert.equal(r.removed,0);
 s.life.trashed_at=new Date(0);s.life.trash_reason='expired';r=await runNewsRetention();assert.equal(r.removed,1);assert.equal(r.images,1);assert.equal(s.heads,0);assert.equal(s.deletedObjects,0);assert.ok(s.news);assert.ok(s.statements.includes('BEGIN READ ONLY'));assert.equal(s.statements.some(q=>/^(UPDATE|DELETE|INSERT)/.test(q)),false);
});
test('cleanup expires, purges with durable tombstone, verifies exclusive images and is idempotent',async()=>{
 const s=setup();let r=await runNewsRetention({dryRun:false});assert.equal(r.expired,1);assert.equal(r.removed,0);assert.ok(s.life.purge_after>Date.now()+6*86400000);
 s.life.purge_after=new Date(0);r=await runNewsRetention({dryRun:false});assert.equal(r.removed,1);assert.equal(r.images,1);assert.equal(s.news,null);assert.equal(s.tombstone,true);assert.equal(s.deletedObjects,1);await runNewsRetention({dryRun:false});assert.equal(s.deletedObjects,1);
});
test('manual publications reuse expiry, recovery and exclusive R2 cleanup',async()=>{
 const s=setup();s.life.automatic=false;s.proof.sourceType='manual';
 let r=await runNewsRetention({dryRun:false});assert.equal(r.expired,1);assert.equal(r.removed,0);s.life.purge_after=new Date(0);r=await runNewsRetention({dryRun:false});assert.equal(r.removed,1);assert.equal(r.images,1);
});
test('15-day boundary and recovery boundary preserve a full publication and recovery period',async()=>{
 const s=setup();s.life.expires_at=new Date(Date.now()+10000);s.life.purge_after=new Date(Date.now()+7*86400000);
 assert.equal((await runNewsRetention()).expired,0);
 s.life.expires_at=new Date(Date.now()-1);const r=await runNewsRetention();assert.equal(r.expired,1);assert.equal(r.removed,0);
 s.life.trashed_at=new Date(0);s.life.trash_reason='expired';s.life.purge_after=new Date(Date.now()-1);assert.equal((await runNewsRetention()).removed,1);
});
test('prospective enrollment skips old publication dates and missing activation; edits never enroll legacy rows',async()=>{
 const s=setup();s.calls=[];const old=new Date(new Date(s.policy.prospective_from).getTime()-1).toISOString();
 for(const automatic of [false,true]){const count=s.calls.length;await registerNewsRetention(s.pool,id,'PUBLISHED',null,s.policy,automatic,old);assert.equal(s.calls.length,count);}
 const count=s.calls.length;await registerNewsRetention(s.pool,id,'PUBLISHED',null,{...s.policy,prospective_from:undefined});assert.equal(s.calls.length,count);
 s.policy.prospective_from=undefined;assert.equal((await runNewsRetention()).ready,false);
 const input=new FormData();for(const[k,v]of Object.entries(retentionDefaults))input.set(k,String(v));input.set('publication_hours','1');assert.equal(retentionInput(input).publication_hours,360);
});
test('disabled cleanup still expires news, disabled sources do not participate in maintenance',async()=>{
 const s=setup();s.policy.cleanup_enabled=false;const r=await runNewsRetention({dryRun:false});assert.equal(r.expired,1);assert.ok(s.news);assert.equal(s.news.status,'ARCHIVED');assert.equal(r.removed,0);assert.equal(s.deletedObjects,0);assert.equal(s.statements.some(q=>q.includes('a.enabled')),false);
});
test('shared, external and unproven media are never deleted; R2 errors remain queued',async()=>{
 const sample={path:image,mime_type:'image/webp'};assert.equal(managedMediaProof(sample,{storageProvider:'r2',sourceType:'import',objectKey:image.slice(1)}),true);assert.equal(managedMediaProof({...sample,path:'https://third.example/a.jpg'},{}),false);assert.equal(managedMediaProof(sample,{storageProvider:'local'}),false);
 for(const option of [{shared:true},{proof:{storageProvider:'local'}}]){const s=setup(option);s.life.trashed_at=new Date(0);s.life.trash_reason='expired';await runNewsRetention({dryRun:false});assert.equal(s.deletedObjects,0);assert.ok(s.asset);}
 const s=setup({failR2:true});s.life.trashed_at=new Date(0);s.life.trash_reason='expired';const r=await runNewsRetention({dryRun:false});assert.equal(r.errors,1);assert.equal(s.queue,true);assert.equal(s.retry,true);assert.ok(s.asset);
});
test('editing automatic articles protects them; missing migration and concurrent runs fail closed',async()=>{
 const s=setup();await editorialLifecycle(s.pool,id,'PUBLISHED',null);assert.equal(s.life.editorial_protected,true);
 setup({ready:false});assert.equal((await runNewsRetention()).ready,false);
 setup({busy:true});assert.equal((await runNewsRetention({dryRun:false})).busy,true);
});
test('public view covers expiry/trash on every consumer and leaves old/manual articles intact',()=>{
 const sql=readFileSync(new URL('../database/migrations/011_news_lifecycle.sql',import.meta.url),'utf8');
 assert.match(sql,/NOT EXISTS \(SELECT 1 FROM news_lifecycle/);assert.match(sql,/l\.automatic AND NOT l\.permanent AND l\.expires_at<=now\(\)/);assert.match(sql,/l\.trashed_at IS NOT NULL/);assert.doesNotMatch(sql,/DELETE FROM news|INSERT INTO news_lifecycle|UPDATE news SET/);assert.match(sql,/cleanup_enabled boolean NOT NULL DEFAULT false/);
 assert.match(sql,/CREATE VIEW public_news_managed AS/);
 assert.doesNotMatch(sql.replace(/--[^\n]*/g,''),/CREATE OR REPLACE|\bDROP\b|\bTRUNCATE\b|ALTER COLUMN/);
 const importer=readFileSync(new URL('../server/services/source-automation.ts',import.meta.url),'utf8');assert.match(importer,/news_origin_tombstones/);assert.match(importer,/Math\.min\(source.max_items,budget.remaining\)/);
});
test('012 enrolls no legacy data and public view protects manual/automatic, pinned and protected news',()=>{
 const sql=readFileSync(new URL('../database/migrations/012_fifteen_day_retention.sql',import.meta.url),'utf8');
 assert.match(sql,/retention_managed boolean NOT NULL DEFAULT false/);assert.match(sql,/CHECK\(publication_hours=360\)/);
 assert.match(sql,/l.retention_managed AND NOT l.permanent AND NOT l.editorial_protected/);assert.match(sql,/NOT n.featured/);assert.match(sql,/HOME_LEAD_NEWS_ID/);
 assert.doesNotMatch(sql,/UPDATE news_lifecycle|INSERT INTO news_lifecycle|DELETE FROM|UPDATE news SET/);
});
test('cron requires its secret and dry-run never imports or writes',async()=>{
 const {GET}=await import('../app/api/cron/sources/route.ts');const original=process.env.CRON_SECRET;process.env.CRON_SECRET='isolated-test-secret-not-a-real-key-12345';
 try{const s=setup();assert.equal((await GET(new Request('http://localhost/api/cron/sources'))).status,401);assert.equal(s.statements.length,0);
 const r=await GET(new Request('http://localhost/api/cron/sources?dryRun=1',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}}));assert.equal(r.status,200);assert.equal(s.synchronizations,undefined);assert.equal(s.deletedObjects,0);assert.equal(s.statements.some(q=>/^(INSERT|UPDATE|DELETE)/.test(q)),false);
 }finally{if(original===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=original;}
});
