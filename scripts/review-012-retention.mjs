// Production is read-only: back up, restore to an isolated local PostgreSQL, review 012 there.
import './env.mjs';
import {Pool} from 'pg';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import {createServer} from 'node:net';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {secureConnectionString} from '../lib/db/connection-string.mjs';
import {databaseIdentity} from '../lib/editorial/initial-import.mjs';

const guard=JSON.parse(await readFile('scripts/initial-news.json'));
if(process.env.SITE_NAME!=='UPOST.uy'||databaseIdentity(process.env.DATABASE_URL||'').fingerprint!==guard.databaseFingerprint)throw Error('Banco exclusivo de UPOST no confirmado.');
if(process.argv.slice(2).some(a=>!a.startsWith('--backup=')))throw Error('Solo se permite revisión.');
const name='012_fifteen_day_retention.sql',sql=await readFile('database/migrations/'+name,'utf8');
if(/\b(?:DELETE|DROP|TRUNCATE)\b|(?:UPDATE|INSERT INTO)\s+news(?:\s|\()/i.test(sql))throw Error('Migración fuera de la revisión no destructiva.');
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),tools='C:/Program Files/PostgreSQL/18/bin/';
const direct=new URL(process.env.DATABASE_URL);direct.hostname=direct.hostname.replace(/-pooler(?=\.)/,'');
const production=new Pool({connectionString:secureConnectionString(direct.href),connectionTimeoutMillis:10000,statement_timeout:10000});
let policy;
try{
 const db=await production.connect();try{
  await db.query('BEGIN READ ONLY');
  const history=(await db.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows;
  const prior=history.find(r=>r.name==='011_news_lifecycle.sql');
  if(!prior||prior.checksum!==createHash('sha256').update(await readFile('database/migrations/011_news_lifecycle.sql')).digest('hex'))throw Error('Historial 011 divergente.');
  if(history.some(r=>r.name===name))throw Error('012 ya aplicada: revisar estado sin repetirla.');
  policy=(await db.query('SELECT * FROM news_retention_policy WHERE id=true')).rows[0];
  await db.query('ROLLBACK');
 }finally{db.release();}
}finally{await production.end();}

const logFolder=path.resolve('storage/logs');await mkdir(logFolder,{recursive:true});
async function command(exe,args,env){
 return new Promise((resolve,reject)=>{
  const child=spawn(tools+exe,args,{env,windowsHide:true,stdio:['ignore','ignore','pipe']});
  child.stderr.resume();const timer=setTimeout(()=>child.kill(),180000);
  child.once('error',()=>{clearTimeout(timer);reject(Error('No se pudo iniciar '+exe));});
  child.once('exit',code=>{clearTimeout(timer);if(code===0)resolve();else reject(Error(exe+' falló: '+code));});
 });
}
await mkdir('storage/backups',{recursive:true});
const ca=path.resolve('storage/backups/retention-review-ca.pem');await writeFile(ca,rootCertificates.join('\n'));
const remoteEnv={...process.env,PGHOST:direct.hostname,PGPORT:direct.port||'5432',PGDATABASE:decodeURIComponent(direct.pathname.slice(1)),PGUSER:decodeURIComponent(direct.username),PGPASSWORD:decodeURIComponent(direct.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:ca,PGCONNECT_TIMEOUT:'15'};
const supplied=process.argv.find(a=>a.startsWith('--backup='))?.slice(9);
const backup=path.resolve(supplied||'storage/backups/upost-before-012-'+stamp+'.dump');
if(!backup.startsWith(path.resolve('storage/backups')+path.sep))throw Error('Ruta de backup inválida.');
if(supplied){const manifest=JSON.parse(await readFile(backup+'.json'));if(manifest.sha256!==createHash('sha256').update(await readFile(backup)).digest('hex'))throw Error('Checksum de backup divergente.');}
else await command('pg_dump.exe',['--no-password','--format=custom','--no-owner','--no-acl','--file',backup],remoteEnv);
await command('pg_restore.exe',['--list',backup],process.env);
await command('pg_restore.exe',['--no-owner','--no-acl','--file=NUL',backup],process.env);
const report={migration:name,checksum:createHash('sha256').update(sql).digest('hex'),backup,bytes:(await stat(backup)).size,sha256:createHash('sha256').update(await readFile(backup)).digest('hex'),archiveFullyRead:true,productionPolicy:policy,productionModified:false};
await writeFile(backup+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({step:'backup-verified',backup,bytes:report.bytes}));

const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const folder=path.resolve('.test-postgres/retention-012-'+stamp);await mkdir(folder,{recursive:true});
const data=path.join(folder,'data'),localUrl=`postgresql://postgres@127.0.0.1:${port}/postgres`;
const localEnv={...process.env,PGHOST:'127.0.0.1',PGPORT:String(port),PGUSER:'postgres',PGPASSWORD:'',PGDATABASE:'postgres',PGSSLMODE:'disable'};
let started=false,local;
async function fingerprint(db,table,omit=''){
 if(!['news','news_categories','authors','media_assets','source_automation','source_news_items','news_lifecycle'].includes(table))throw Error('Invalid table');
 return (await db.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(row::text,'' ORDER BY row::text),'')) AS fingerprint FROM (SELECT to_jsonb(t)${omit?"-'retention_managed'":''} AS row FROM ${table} t) x`)).rows[0];
}
try{
 await command('initdb.exe',['-D',data,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C'],localEnv);
 await command('pg_ctl.exe',['-D',data,'-l',path.join(folder,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start'],localEnv);started=true;
 await command('pg_restore.exe',['--exit-on-error','--no-owner','--no-acl','--dbname=postgres',backup],localEnv);
 local=new Pool({connectionString:localUrl});
 const tables=['news','news_categories','authors','media_assets','source_automation','source_news_items','news_lifecycle'],before={};
 for(const table of tables)before[table]=await fingerprint(local,table);
 const limits=['global_daily_limit','min_sync_minutes','recovery_days','active_limit'];
 await local.query('BEGIN');await local.query(sql);
 for(const table of tables){const after=await fingerprint(local,table,table==='news_lifecycle'?'managed':'');if(JSON.stringify(after)!==JSON.stringify(before[table]))throw Error('012 cambió datos existentes: '+table);}
 const next=(await local.query('SELECT * FROM news_retention_policy WHERE id=true')).rows[0];
 if(next.publication_hours!==360||next.cleanup_enabled||limits.some(k=>next[k]!==policy[k]))throw Error('Política o límites divergentes.');
 const enrolled=Number((await local.query('SELECT count(*) FROM news_lifecycle WHERE retention_managed')).rows[0].count);
 if(enrolled!==0)throw Error('Inscripción retroactiva detectada.');
 await local.query('COMMIT');
 registerHooks({resolve(s,c,next){
  if(s==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
  if(s.startsWith('@/')||(s.startsWith('.')&&c.parentURL?.startsWith(new URL('../',import.meta.url).href)&&!c.parentURL.includes('/node_modules/'))){const base=s.startsWith('@/')?new URL('../'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of['','.ts','.mjs']){const url=new URL(base.href+ext);if(existsSync(url))return next(url.href,c);}}
  return next(s,c);
 }});
 process.env.DATABASE_URL=localUrl;
 const {runNewsRetention}=await import('../server/services/news-lifecycle.ts');
 const dryRun=await runNewsRetention({dryRun:true});
 const {getPool}=await import('../lib/db/pool.ts');await getPool().end();
 if(!dryRun.ready||dryRun.expired||dryRun.removed||dryRun.images||dryRun.errors)throw Error('Dry-run prospectivo divergente.');
 Object.assign(report,{restoredLocally:true,migrationReviewedLocally:true,existingDataPreserved:true,importLimitsPreserved:true,legacyEnrolled:enrolled,reviewedHours:next.publication_hours,recoveryDays:next.recovery_days,dryRun,productionModified:false});
 await writeFile(backup+'.review.json',JSON.stringify(report,null,2));console.log(JSON.stringify({step:'review-complete',report:backup+'.review.json',existingDataPreserved:true,importLimitsPreserved:true,reviewedHours:next.publication_hours,dryRun,productionModified:false}));
}finally{
 if(local)await local.end();
 if(started)await command('pg_ctl.exe',['-D',data,'-m','fast','-w','stop'],localEnv);
}
