import './env.mjs';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {Pool} from 'pg';
import {databaseIdentity} from '../lib/editorial/initial-import.mjs';
import {secureConnectionString} from '../lib/db/connection-string.mjs';
const name='010_source_automation.sql';
const guard=JSON.parse(await readFile('scripts/initial-news.json'));
const identity=databaseIdentity(process.env.DATABASE_URL||'');
if(process.env.SITE_NAME!=='UPOST.uy'||identity.fingerprint!==guard.databaseFingerprint)throw Error('Neon exclusivo do UPOST não confirmado.');
const sql=await readFile('database/migrations/'+name,'utf8');
const statements=sql.replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean);
if(!statements.length||statements.some(s=>!/^CREATE (?:TABLE|INDEX)\b/i.test(s)))throw Error('A 010 contém comandos fora da revisão aditiva aprovada.');
const checksum=createHash('sha256').update(sql).digest('hex');
// Neon recommends a direct endpoint for administrative session state and pg_dump.
const direct=new URL(process.env.DATABASE_URL);direct.hostname=direct.hostname.replace(/-pooler(?=\.)/,'');
const pool=new Pool({connectionString:secureConnectionString(direct.href),connectionTimeoutMillis:10000,statement_timeout:60000,query_timeout:65000});
const client=await pool.connect();
async function command(exe,args,env=process.env){
 await new Promise((resolve,reject)=>{const child=spawn(exe,args,{env,windowsHide:true,stdio:['ignore','ignore','pipe']});child.stderr.resume();const timer=setTimeout(()=>child.kill(),180000);child.on('error',()=>{clearTimeout(timer);reject(Error('Não foi possível iniciar a ferramenta de backup.'));});child.on('exit',code=>{clearTimeout(timer);if(code===0)resolve();else reject(Error('Backup/verificação falhou; código '+code));});});
}
async function fingerprints(){
 const result={};for(const table of ['users','sessions','news','news_categories','authors','categories','portal_resources','media_assets','ad_slots','ad_campaigns']){
  result[table]=(await client.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(row::text,'' ORDER BY row::text),'')) AS fingerprint FROM (SELECT to_jsonb(t) AS row FROM public.${table} t) s`)).rows[0];
 }return result;
}
try{
 await client.query('SELECT pg_advisory_lock(84201901)');
 const applied=(await client.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows;
 for(const previous of applied){if(createHash('sha256').update(await readFile('database/migrations/'+previous.name)).digest('hex')!==previous.checksum)throw Error('Checksum divergente: '+previous.name);}
 if(applied.some(m=>m.name===name)){console.log(JSON.stringify({alreadyApplied:true,migration:name}));}
 else{
  if(applied.length!==9)throw Error('Esperadas exatamente as nove migrações anteriores. Nenhuma outra será executada.');
  await client.query('SELECT id,kind,name,url,feed_url,category_slug FROM portal_resources LIMIT 0');
  await client.query('SELECT id,source_url,canonical_url FROM news LIMIT 0');
  const objects=statements.map(s=>s.match(/^CREATE (?:TABLE|INDEX)\s+(\w+)/i)[1]);
  for(const object of objects)if((await client.query('SELECT to_regclass($1) AS object',['public.'+object])).rows[0].object)throw Error('Objeto já existe sem registro da 010: '+object);
  console.log(JSON.stringify({target:'Neon exclusivo UPOST',compatible:true,additiveStatements:statements.length,otherMigrationsToRun:0,mode:process.argv.includes('--commit')?'commit':'dry-run'}));
  if(process.argv.includes('--commit')){
   const folder=path.resolve('storage/backups');await mkdir(folder,{recursive:true});
   const timestamp=new Date().toISOString().replace(/[:.]/g,'-');
   const backup=path.join(folder,'upost-before-010-'+timestamp+'.dump'),ca=path.join(folder,'postgres-ca.pem');
   await writeFile(ca,rootCertificates.join('\n'));
   const url=direct;
   const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:ca,PGCONNECT_TIMEOUT:'15'};
   await command('C:/Program Files/PostgreSQL/18/bin/pg_dump.exe',['--no-password','--format=custom','--no-owner','--no-acl','--file',backup],env);
   await command('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe',['--list',backup]);
   await command('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe',['--no-owner','--no-acl','--file=NUL',backup]);
   const bytes=(await stat(backup)).size;if(bytes<1000)throw Error('Backup inesperadamente pequeno.');
   const backupSha256=createHash('sha256').update(await readFile(backup)).digest('hex');
   const report={migration:name,checksum,backup,bytes,backupSha256,archiveFullyRead:true,databaseFingerprint:identity.fingerprint};
   await writeFile(backup+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,step:'backup-verified'}));
   await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
   await client.query("SET LOCAL lock_timeout='5s'");
   const before=await fingerprints();await client.query(sql);const after=await fingerprints();
   if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Dados preexistentes divergiram; a transação será revertida.');
   await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);
   await client.query('COMMIT');
   await writeFile('test-results/source-migration-result.json',JSON.stringify({...report,applied:true,preserved:before},null,2));
   console.log(JSON.stringify({applied:true,migration:name,preserved:before,executedOnce:true}));
  }
 }
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error(error.message);process.exitCode=1;}
finally{await client.query('SELECT pg_advisory_unlock(84201901)').catch(()=>{});client.release();await pool.end();}
