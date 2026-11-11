import './env.mjs';
import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {databaseIdentity} from '../lib/editorial/initial-import.mjs';
import {secureConnectionString} from '../lib/db/connection-string.mjs';
import {seoBatch} from '../lib/editorial/seo-backfill.mjs';

const args=process.argv.slice(2),allowed=/^--(?:dry-run|apply|kind=(?:news|videos)|after=[a-f0-9-]{36}|batch-size=\d+)$/i;
if(args.some(a=>!allowed.test(a))||args.includes('--apply')&&args.includes('--dry-run'))throw Error('Argumentos inválidos.');
const apply=args.includes('--apply'),kind=args.find(a=>a.startsWith('--kind='))?.split('=')[1],after=args.find(a=>a.startsWith('--after='))?.split('=')[1]||'';
if(after&&!kind)throw Error('La reanudación requiere --kind=news o --kind=videos.');
const guard=JSON.parse(await readFile(new URL('./initial-news.json',import.meta.url)));
if(process.env.SITE_NAME!=='UPOST.uy'||databaseIdentity(process.env.DATABASE_URL||'').fingerprint!==guard.databaseFingerprint)throw Error('Banco exclusivo de UPOST no confirmado.');
const pool=new Pool({connectionString:secureConnectionString(process.env.DATABASE_URL),connectionTimeoutMillis:8000,statement_timeout:10000,query_timeout:12000});
const db=await pool.connect(),totals={dryRun:!apply,news:{scanned:0,changed:0,conflicts:0},videos:{scanned:0,changed:0,conflicts:0}};
try{
 const managed=(await db.query("SELECT to_regclass('public.public_news_managed') IS NOT NULL AS ready")).rows[0].ready;
 for(const type of kind?[kind]:['news','videos']){
  let cursor=after,done=false;
  while(!done){
   await db.query(apply?'BEGIN':'BEGIN READ ONLY');
   try{
    const result=await seoBatch(db,{kind:type,newsTable:managed?'public_news_managed':'public_news',after:cursor,limit:Number(args.find(a=>a.startsWith('--batch-size='))?.split('=')[1]||50),apply});
    await db.query('COMMIT');
    cursor=result.after;done=result.done;
    for(const key of ['scanned','changed','conflicts'])totals[type][key]+=result[key];
    console.log(JSON.stringify({dryRun:!apply,...result}));
   }catch(error){await db.query('ROLLBACK');throw error;}
  }
 }
 console.log(JSON.stringify({summary:totals}));
}finally{db.release();await pool.end();}
