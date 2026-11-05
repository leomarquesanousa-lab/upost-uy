import './env.mjs';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {databaseIdentity} from '../lib/editorial/initial-import.mjs';
registerHooks({resolve(specifier,context,next){
 if(specifier==='server-only')return {url:new URL('../node_modules/next/dist/compiled/server-only/empty.js',import.meta.url).href,shortCircuit:true};
 if(specifier.startsWith('@/')||(specifier.startsWith('.')&&context.parentURL?.startsWith(new URL('../',import.meta.url).href)&&!context.parentURL.includes('/node_modules/'))){const base=specifier.startsWith('@/')?new URL('../'+specifier.slice(2),import.meta.url):new URL(specifier,context.parentURL);for(const suffix of ['','.ts','.mjs']){const url=new URL(base.href+suffix);if(existsSync(url))return next(url.href,context);}}
 return next(specifier,context);
}});
const guard=JSON.parse(await readFile(new URL('./initial-news.json',import.meta.url)));
if(process.env.SITE_NAME!=='UPOST.uy'||databaseIdentity(process.env.DATABASE_URL||'').fingerprint!==guard.databaseFingerprint)throw Error('Banco exclusivo do UPOST não confirmado.');
const {getPool}=await import('../lib/db/pool.ts');
try{const {synchronizeSources}=await import('../server/services/source-automation.ts');const result=await synchronizeSources();console.log(JSON.stringify(result));if(result.results.some(r=>r.status==='error'))process.exitCode=1;}
catch(error){console.error('Falha na sincronização:',error.code==='42P01'?'Aplique manualmente a migração 010 antes de agendar.':error.code||'SYNC_ERROR');process.exitCode=1;}
finally{await getPool().end();}
