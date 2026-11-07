// Controlled, one-migration-only application. Default is review; --commit requires verified backup.
import './env.mjs';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {Pool} from 'pg';
import {databaseIdentity} from '../lib/editorial/initial-import.mjs';
import {secureConnectionString} from '../lib/db/connection-string.mjs';
const name='011_news_lifecycle.sql',guard=JSON.parse(await readFile('scripts/initial-news.json'));
if(process.env.SITE_NAME!=='UPOST.uy'||databaseIdentity(process.env.DATABASE_URL||'').fingerprint!==guard.databaseFingerprint)throw Error('Neon exclusivo do UPOST não confirmado.');
const sql=await readFile('database/migrations/'+name,'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
const statements=sql.replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean);
if(!statements.length||statements.some(s=>!/^CREATE (TABLE|INDEX|VIEW)\b/i.test(s)&&!/^ALTER TABLE source_automation ADD COLUMN daily_limit\b/i.test(s)&&!/^INSERT INTO news_retention_policy\(id\) VALUES\(true\)$/i.test(s)))throw Error('Comando fora da revisão exclusivamente aditiva.');
const direct=new URL(process.env.DATABASE_URL);direct.hostname=direct.hostname.replace(/-pooler(?=\.)/,'');
const pool=new Pool({connectionString:secureConnectionString(direct.href),connectionTimeoutMillis:10000,statement_timeout:60000,query_timeout:65000}),client=await pool.connect();
let locked=false;
async function command(exe,args,env=process.env){
 await new Promise((resolve,reject)=>{const child=spawn(exe,args,{env,windowsHide:true,stdio:['ignore','ignore','pipe']});child.stderr.resume();const timeout=setTimeout(()=>child.kill(),180000);child.once('error',()=>{clearTimeout(timeout);reject(Error('Ferramenta de backup indisponível.'));});child.once('exit',code=>{clearTimeout(timeout);if(code===0)resolve();else reject(Error('Backup ou verificação falhou.'));});});
}
async function fingerprints(){
 const data={};for(const table of ['users','sessions','news','news_categories','authors','categories','portal_resources','media_assets','ad_slots','ad_campaigns','source_automation','source_news_items']){
  const row=table==='source_automation'?"to_jsonb(t)-'daily_limit'":'to_jsonb(t)';
  data[table]=(await client.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(row::text,'' ORDER BY row::text),'')) AS fingerprint FROM (SELECT ${row} AS row FROM public.${table} t) s`)).rows[0];
 }return data;
}
try{
 locked=(await client.query('SELECT pg_try_advisory_lock(84201901) AS locked')).rows[0].locked;if(!locked)throw Error('Outra migração está em curso.');
 const previous=(await client.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows;
 const applied=previous.find(m=>m.name===name);
 if(applied){if(applied.checksum!==checksum)throw Error('Checksum da 011 divergente.');console.log(JSON.stringify({alreadyApplied:true,migration:name}));}
 else{
  if(previous.length!==10||!previous.some(m=>m.name==='010_source_automation.sql'))throw Error('Histórico diferente das dez migrações esperadas.');
  const prior=previous.find(m=>m.name==='010_source_automation.sql');if(createHash('sha256').update(await readFile('database/migrations/'+prior.name)).digest('hex')!==prior.checksum)throw Error('Migração anterior divergente.');
  for(const statement of statements.filter(s=>/^CREATE /i.test(s))){const object=statement.match(/^CREATE (?:TABLE|INDEX|VIEW)\s+(\w+)/i)[1];if((await client.query('SELECT to_regclass($1) AS object',['public.'+object])).rows[0].object)throw Error('Objeto preexistente sem registro da 011: '+object);}
  if((await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='source_automation' AND column_name='daily_limit'")).rowCount)throw Error('Coluna da 011 já existe sem registro.');
  const viewBefore=(await client.query("SELECT pg_get_viewdef('public.public_news'::regclass,true) AS definition")).rows[0].definition;
  console.log(JSON.stringify({exclusiveUpost:true,additive:true,migration:name,mode:process.argv.includes('--commit')?'commit':'review'}));
  if(process.argv.includes('--commit')){
   const folder=path.resolve('storage/backups');await mkdir(folder,{recursive:true});
   const backup=path.join(folder,'upost-before-011-'+new Date().toISOString().replace(/[:.]/g,'-')+'.dump'),ca=path.join(folder,'postgres-ca.pem');
   await writeFile(ca,rootCertificates.join('\n'));
   const env={...process.env,PGHOST:direct.hostname,PGPORT:direct.port||'5432',PGDATABASE:decodeURIComponent(direct.pathname.slice(1)),PGUSER:decodeURIComponent(direct.username),PGPASSWORD:decodeURIComponent(direct.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:ca,PGCONNECT_TIMEOUT:'15'};
   await command('C:/Program Files/PostgreSQL/18/bin/pg_dump.exe',['--no-password','--format=custom','--no-owner','--no-acl','--file',backup],env);
   await command('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe',['--list',backup]);
   await command('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe',['--no-owner','--no-acl','--file=NUL',backup]);
   if((await stat(backup)).size<1000)throw Error('Backup inesperadamente pequeno.');
   const report={migration:name,checksum,backup,bytes:(await stat(backup)).size,sha256:createHash('sha256').update(await readFile(backup)).digest('hex'),archiveFullyVerified:true};
   await writeFile(backup+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,step:'backup-verified'}));
   await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await client.query("SET LOCAL lock_timeout='5s'");
   const before=await fingerprints();await client.query(sql);const after=await fingerprints();
   if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Dados existentes divergiram; revertendo.');
   const viewAfter=(await client.query("SELECT pg_get_viewdef('public.public_news'::regclass,true) AS definition")).rows[0].definition;
   if(viewBefore!==viewAfter)throw Error('A view original foi alterada; revertendo.');
   const validation=(await client.query('SELECT (SELECT count(*) FROM news_lifecycle)::int AS lifecycle,(SELECT count(*) FROM public_news)::int AS original,(SELECT count(*) FROM public_news_managed)::int AS managed,(SELECT cleanup_enabled FROM news_retention_policy WHERE id=true) AS cleanup_enabled')).rows[0];
   if(validation.lifecycle!==0||validation.original!==validation.managed||validation.cleanup_enabled)throw Error('Transição retroativa detectada; revertendo.');
   await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);await client.query('COMMIT');
   await writeFile(backup+'.applied.json',JSON.stringify({...report,applied:true,validation,preserved:before},null,2));
   console.log(JSON.stringify({applied:true,migration:name,existingDataPreserved:true,originalViewPreserved:true,validation}));
  }
 }
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error(error.code?'Verificação/migração falhou: '+error.code:error.message);process.exitCode=1;}
finally{if(locked)await client.query('SELECT pg_advisory_unlock(84201901)').catch(()=>{});client.release();await pool.end();}
