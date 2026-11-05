// Enable eligible summary/photo publication only after the three reviewed stories are public.
import './env.mjs';import{Pool}from'pg';import{readFile,writeFile}from'node:fs/promises';
import{databaseIdentity}from'../lib/editorial/initial-import.mjs';import{secureConnectionString}from'../lib/db/connection-string.mjs';import{initialSources}from'../lib/editorial/source-sync.mjs';
const guard=JSON.parse(await readFile('scripts/initial-news.json'));if(process.env.SITE_NAME!=='UPOST.uy'||databaseIdentity(process.env.DATABASE_URL||'').fingerprint!==guard.databaseFingerprint)throw Error('Wrong database');
const reviews=JSON.parse(await readFile('test-results/reviewed-source-news.json'));
const p=new Pool({connectionString:secureConnectionString(process.env.DATABASE_URL),connectionTimeoutMillis:8000,statement_timeout:10000,query_timeout:12000});const c=await p.connect();
try{
 if(reviews.length!==3||(await c.query("SELECT id FROM public_news WHERE id=ANY($1::uuid[]) AND cover_image<>''",[reviews.map(n=>n.id)])).rowCount!==3)throw Error('Three reviewed photographed publications must exist first.');
 if(!process.argv.includes('--commit')){console.log('Dry run: three reviewed publications verified.');}
 else{
  await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");await c.query('SELECT pg_advisory_xact_lock(84201913)');
  const owner=(await c.query("SELECT id FROM users WHERE role='OWNER' AND active AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1")).rows[0]?.id;if(!owner)throw Error('No active owner');
  const result=await c.query(`UPDATE source_automation a SET enabled=true,interval_minutes=30,max_items=1,publication_mode='automatic',content_mode='summary',next_sync_at=date_bin(interval '30 minutes',now(),timestamptz '2000-01-01')+interval '30 minutes' FROM portal_resources r WHERE r.id=a.resource_id AND r.kind='source' AND r.active AND r.url=ANY($1::text[]) RETURNING r.name,a.*`,[initialSources.map(s=>s.url)]);
  if(result.rowCount!==3)throw Error('Exactly three active configured sources required.');
  for(const row of result.rows)await c.query("INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES($1,'source.auto_publication_enabled','portal_resources',$2,$3)",[owner,row.resource_id,JSON.stringify({intervalMinutes:30,maxItems:1,summaryOnly:true,photographRequired:true,reviewedStoryIds:reviews.map(n=>n.id)})]);
  await c.query('COMMIT');await writeFile('test-results/source-auto-publication.json',JSON.stringify(result.rows,null,2));console.log(JSON.stringify(result.rows));
 }
}catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();await p.end();}
