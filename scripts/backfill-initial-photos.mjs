import './env.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {fetchRemotePage,fetchRemoteFeed} from '../lib/security/remote-page.mjs';
import {extractArticle} from '../lib/editorial/import-article.mjs';
import {databaseIdentity} from '../lib/editorial/initial-import.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
registerHooks({resolve(specifier,context,next){
 if(specifier==='server-only')return {url:new URL('../node_modules/next/dist/compiled/server-only/empty.js',import.meta.url).href,shortCircuit:true};
 if(specifier.startsWith('@/')||(specifier.startsWith('.')&&context.parentURL?.startsWith(new URL('../',import.meta.url).href)&&!context.parentURL.includes('/node_modules/'))){
  const base=specifier.startsWith('@/')?new URL('../'+specifier.slice(2),import.meta.url):new URL(specifier,context.parentURL);
  for(const suffix of ['','.ts','.mjs']){const url=new URL(base.href+suffix);if(existsSync(url))return next(url.href,context);}
 }
 return next(specifier,context);
}});
const commit=process.argv.includes('--commit');
let pool,lock;
const results=[];
try{
 const manifest=JSON.parse(await readFile(path.join(root,'scripts/initial-news.json'),'utf8'));
 const identity=databaseIdentity(process.env.DATABASE_URL||'');
 if(path.resolve(process.cwd()).toLowerCase()!==path.resolve(root).toLowerCase()||process.env.SITE_NAME!=='UPOST.uy'||identity.fingerprint!==manifest.databaseFingerprint)throw Error('Identidade do UPOST ou banco Neon divergente.');
 const {getPool}=await import('../lib/db/pool.ts');
 const {importEditorialImage}=await import('../server/services/import-editorial-image.ts');
 const {assertEditorialImage,inspectEditorialImage}=await import('../server/services/editorial-media.ts');
 const {imageStorageProvider}=await import('../server/services/storage.ts');
 const provider=imageStorageProvider();
 const directory=path.relative(root,path.resolve(process.env.UPLOAD_DIR||'storage/uploads'));
 if(provider==='local'&&(directory.startsWith('..')||path.isAbsolute(directory)))throw Error('O armazenamento local precisa estar dentro do projeto UPOST.');
 pool=getPool();
 const owner=(await pool.query("SELECT id FROM users WHERE role='OWNER' AND active AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1")).rows[0]?.id;
 if(!owner)throw Error('OWNER ativo não encontrado.');
 const rows=(await pool.query('SELECT id,title,source_url,cover_image,cover_credit,version FROM news WHERE source_url=ANY($1::text[])',[manifest.articles.map(item=>item.url)])).rows;
 if(rows.length!==5)throw Error('A atualização exige exatamente as cinco notícias existentes.');
 console.log(JSON.stringify({target:'UPOST.uy / Neon',fingerprint:identity.fingerprint,mode:commit?'commit':'dry-run',provider,existingNews:rows.length}));
 if(commit){lock=await pool.connect();await lock.query('SELECT pg_advisory_lock(84201906)');}
 const feeds=new Map();
 for(const source of new Set(manifest.articles.map(item=>item.feedUrl))){
  try{feeds.set(source,(await fetchRemoteFeed(source)).html);}catch{feeds.set(source,'');}
 }
 for(const item of manifest.articles){
  const row=rows.find(n=>n.source_url===item.url),attempts=[];
  try{
   if(row.cover_image&&(await inspectEditorialImage(row.cover_image)).usable){results.push({id:row.id,title:row.title,status:'already-present',path:row.cover_image,credit:row.cover_credit});continue;}
   const page=await fetchRemotePage(item.url);
   const article=extractArticle(page.html,item.url,page.url,{feedXml:feeds.get(item.feedUrl)});
   if(article.title!==row.title)throw Error('O título original não corresponde à notícia existente.');
   if(!article.cover_candidates.length)throw Error('Nenhuma fotografia disponível nos metadados, RSS ou HTML.');
   if(!commit){results.push({id:row.id,title:row.title,candidates:article.cover_candidates.slice(0,4)});continue;}
   let chosen,stored;
   for(const image of article.cover_candidates.slice(0,12)){
    try{stored=await importEditorialImage(image.url,owner);chosen=image;break;}
    catch(error){attempts.push({url:image.url,reason:error.message});}
   }
   if(!chosen||!stored)throw Error('Nenhuma candidata pôde ser descarregada e armazenada.');
   const client=await pool.connect();
   try{
    await client.query('BEGIN');await assertEditorialImage(stored,client);
    const update=await client.query('UPDATE news SET cover_image=$1,cover_alt=$2,cover_caption=$3,cover_credit=$4,updated_by=$5,updated_at=now(),version=version+1 WHERE id=$6 AND version=$7 AND source_url=$8 RETURNING id',
     [stored,chosen.alt||row.title,chosen.caption,chosen.credit,owner,row.id,row.version,row.source_url]);
    if(update.rowCount!==1)throw Error('A notícia foi alterada durante a importação; atualização cancelada.');
    await client.query('INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',
     [owner,'news.cover_import','news',row.id,JSON.stringify({source_url:row.source_url,image_url:chosen.url,path:stored,credit:chosen.credit,storageProvider:provider})]);
    await client.query('COMMIT');
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
   results.push({id:row.id,title:row.title,status:'updated',imageUrl:chosen.url,path:stored,credit:chosen.credit,caption:chosen.caption,attempts});
  }catch(error){results.push({id:row.id,title:row.title,status:'failed',sourceUrl:item.url,reason:error.message,attempts});process.exitCode=1;}
 }
 const counts=(await pool.query("SELECT (SELECT count(*)::int FROM news) AS news,(SELECT count(*)::int FROM public_news WHERE source_url=ANY($1::text[]) AND cover_image<>'') AS with_photos,(SELECT count(*)::int FROM schema_migrations) AS migrations",[manifest.articles.map(item=>item.url)])).rows[0];
 console.log(JSON.stringify({results,counts}));
 if(commit)await writeFile(path.join(root,'docs/UPOST-FOTOS-RESULTADO.json'),JSON.stringify({provider,results,counts},null,2)+'\n');
}catch(error){console.error('Falha na correção das fotos: '+(error.message||'erro técnico'));process.exitCode=1;}
finally{if(lock){await lock.query('SELECT pg_advisory_unlock(84201906)').catch(()=>{});lock.release();}if(pool)await pool.end();}
