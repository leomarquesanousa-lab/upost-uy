// Coordinated UPOST-only activation. Neither mode runs expiry or object deletion.
import './env.mjs';
import {Pool} from 'pg';
import {readFile,realpath} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {hostname} from 'node:os';
import {registerHooks} from 'node:module';
import {databaseIdentity} from '../lib/editorial/initial-import.mjs';
import {secureConnectionString} from '../lib/db/connection-string.mjs';

const args=process.argv.slice(2),apply=args.includes('--apply'),enable=args.includes('--enable-cleanup');
if(apply===enable||args.some(a=>!/^--(?:apply|enable-cleanup|backup=.+|release=[a-f0-9]{40})$/.test(a)))throw Error('Modo de activación inválido.');
const release=args.find(a=>a.startsWith('--release='))?.slice(10),backup=args.find(a=>a.startsWith('--backup='))?.slice(9);
const cwd=await realpath(process.cwd());
if(hostname()!=='srv2116455'||!cwd.startsWith('/opt/upost/releases/')||!release||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==release)throw Error('Host o release no confirmados.');
if(existsSync('/etc/cron.d/upost-sources'))throw Error('Suspendé solamente el cron de UPOST antes de activar.');
if(enable&&await realpath('/opt/upost/current')!==cwd)throw Error('La release nueva todavía no está publicada.');
const guard=JSON.parse(await readFile('scripts/initial-news.json'));
if(process.env.SITE_NAME!=='UPOST.uy'||databaseIdentity(process.env.DATABASE_URL||'').fingerprint!==guard.databaseFingerprint)throw Error('Neon exclusivo de UPOST no confirmado.');
const name='012_fifteen_day_retention.sql',sql=await readFile('database/migrations/'+name,'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
const pool=new Pool({connectionString:secureConnectionString(process.env.DATABASE_URL),connectionTimeoutMillis:10000,statement_timeout:30000});
const db=await pool.connect();
const tables=['news','news_categories','authors','media_assets','source_automation','source_news_items','news_lifecycle'];
async function fingerprints(after=false){
 const result={};
 for(const table of tables)result[table]=(await db.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(row::text,'' ORDER BY row::text),'')) AS hash FROM (SELECT to_jsonb(t)${after&&table==='news_lifecycle'?"-'retention_managed'":''} AS row FROM ${table} t) s`)).rows[0];
 return result;
}
try{
 if(apply){
  if(!backup?.startsWith('/opt/upost/backups/'))throw Error('Backup verificado obligatorio.');
  const manifest=JSON.parse(await readFile(backup+'.review.json'));
  if(!manifest.restoredLocally||!manifest.existingDataPreserved||manifest.checksum!==checksum||manifest.sha256!==createHash('sha256').update(await readFile(backup)).digest('hex'))throw Error('Backup o revisión divergentes.');
  await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await db.query("SET LOCAL lock_timeout='5s'");
  for(const key of [84201901,84201915,84201914])if(!(await db.query('SELECT pg_try_advisory_xact_lock($1) AS locked',[key])).rows[0].locked)throw Error('Hay otra operación UPOST en curso.');
  const history=(await db.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows;
  const prior=history.find(m=>m.name==='011_news_lifecycle.sql');
  if(!prior||prior.checksum!==createHash('sha256').update(await readFile('database/migrations/011_news_lifecycle.sql')).digest('hex')||history.some(m=>m.name===name))throw Error('Historial de migraciones divergente.');
  const before=await fingerprints(),policy=(await db.query('SELECT * FROM news_retention_policy WHERE id=true FOR UPDATE')).rows[0];
  await db.query(sql);
  if(JSON.stringify(await fingerprints(true))!==JSON.stringify(before))throw Error('Los datos existentes cambiaron.');
  const next=(await db.query('SELECT * FROM news_retention_policy WHERE id=true')).rows[0];
  if(next.publication_hours!==360||next.recovery_days!==7||next.cleanup_enabled||['global_daily_limit','min_sync_minutes','active_limit'].some(k=>next[k]!==policy[k]))throw Error('Política divergente.');
  const managed=Number((await db.query('SELECT count(*) FROM news_lifecycle WHERE retention_managed')).rows[0].count);
  if(managed!==0)throw Error('Inscripción retroactiva detectada.');
  await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);
  await db.query("INSERT INTO audit_log(action,entity,metadata) VALUES('news.retention_activation','settings',$1)",[JSON.stringify({release,migration:name,backupSha256:manifest.sha256,hours:360,recoveryDays:7,cleanupEnabled:false,legacyEnrolled:0})]);
  await db.query('COMMIT');console.log(JSON.stringify({migration:name,applied:true,release,hours:360,recoveryDays:7,cleanupEnabled:false,legacyEnrolled:0,existingDataPreserved:true,importLimitsPreserved:true}));
 }else{
  const migration=(await db.query('SELECT checksum FROM schema_migrations WHERE name=$1',[name])).rows[0];
  if(migration?.checksum!==checksum)throw Error('012 no confirmada.');
  const response=await fetch('http://127.0.0.1:3001/',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('UPOST no responde correctamente.');await response.body?.cancel();
  registerHooks({resolve(s,c,next){
   if(s==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
   if(s.startsWith('@/')||(s.startsWith('.')&&c.parentURL?.startsWith(new URL('../',import.meta.url).href)&&!c.parentURL.includes('/node_modules/'))){const base=s.startsWith('@/')?new URL('../'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of['','.ts','.mjs']){const url=new URL(base.href+ext);if(existsSync(url))return next(url.href,c);}}
   return next(s,c);
  }});
  const {runNewsRetention}=await import('../server/services/news-lifecycle.ts');const dryRun=await runNewsRetention({dryRun:true});
  const {getPool}=await import('../lib/db/pool.ts');await getPool().end();
  if(!dryRun.ready||dryRun.busy||dryRun.expired||dryRun.removed||dryRun.images||dryRun.errors)throw Error('Dry-run no permite habilitar limpieza.');
  await db.query('BEGIN');
  const policy=(await db.query('SELECT * FROM news_retention_policy WHERE id=true FOR UPDATE')).rows[0];
  if(policy.publication_hours!==360||policy.recovery_days!==7||!policy.prospective_from)throw Error('Política no confirmada.');
  await db.query('UPDATE news_retention_policy SET cleanup_enabled=true,updated_at=now() WHERE id=true');
  await db.query("INSERT INTO audit_log(action,entity,metadata) VALUES('news.retention_cleanup_enabled','settings',$1)",[JSON.stringify({release,dryRun,hours:360,recoveryDays:7})]);
  await db.query('COMMIT');console.log(JSON.stringify({cleanupEnabled:true,hours:360,recoveryDays:7,dryRun,deletedDuringActivation:0}));
 }
}catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}
finally{db.release();await pool.end();}
