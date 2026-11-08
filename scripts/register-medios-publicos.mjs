// Preview by default. --activate adds only this source; never imports or publishes articles.
import './env.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {databaseIdentity} from '../lib/editorial/initial-import.mjs';
import {secureConnectionString} from '../lib/db/connection-string.mjs';
import {fetchRemoteFeed,fetchRemotePage,fetchRemoteImage} from '../lib/security/remote-page.mjs';
import sharp from 'sharp';
import {sourceEntries,eligibleEntry,sourceCategory,sourceSummary,canonicalArticle} from '../lib/editorial/source-sync.mjs';
import {mediosPublicosSource as preset,interleaveSourceEntries} from '../lib/editorial/medios-publicos.mjs';
import {extractArticle} from '../lib/editorial/import-article.mjs';
const args=process.argv.slice(2);if(args.some(a=>a!=='--activate'))throw Error('Use somente --activate ou nenhum argumento para simulação.');
const guard=JSON.parse(await readFile('scripts/initial-news.json'));
if(process.env.SITE_NAME!=='UPOST.uy'||databaseIdentity(process.env.DATABASE_URL).fingerprint!==guard.databaseFingerprint)throw Error('Neon exclusivo UPOST não confirmado.');
const source={...preset,category_slug:preset.category,feed_url:preset.feed};
const directory='test-results/medios-publicos';await mkdir(directory,{recursive:true});
const groups=await Promise.all(preset.feeds.map(async(url,i)=>{const page=await fetchRemoteFeed(url,{timeoutMs:12000,allowGzip:true});await writeFile(`${directory}/feed-${i}.xml`,page.html);return sourceEntries(page.html,preset.url,true);}));
const entries=interleaveSourceEntries(groups),eligible=entries.filter(e=>eligibleEntry(e,'')&&sourceCategory(source,e));
if(interleaveSourceEntries([...groups,...groups]).length!==entries.length)throw Error('Falha na deduplicação dos feeds.');
const samples=[];
for(const slug of ['uruguay','mundo','cultura','deportes']){
 const entry=eligible.find(e=>sourceCategory(source,e)===slug);if(!entry)throw Error('Nenhuma notícia recente verificável para '+slug);
 const page=await fetchRemotePage(entry.url,{timeoutMs:12000,allowGzip:true});await writeFile(`${directory}/${slug}.html`,page.html);
 const article=extractArticle(page.html,entry.url,page.url),canonical=canonicalArticle(page.html,page.url,preset.url),summary=sourceSummary(article,entry),photo=article.cover_candidates[0];
 if(!article.title||!summary.text||!Number.isFinite(Date.parse(article.original_published_at||entry.date))||!photo)throw Error('Dados incompletos para '+slug);
 if(new URL(photo.url).hostname!=='mediospublicos.uy')throw Error('A fotografia requer validação do domínio externo antes da ativação.');
 const image=await fetchRemoteImage(photo.url,{timeoutMs:12000}),metadata=await sharp(image.bytes,{limitInputPixels:20000000}).metadata();
 if(!['jpeg','png','webp'].includes(metadata.format)||(metadata.pages||1)!==1||metadata.width<200||metadata.height<100)throw Error('Fotografia inválida para '+slug);
 samples.push({category:slug,title:article.title,summary:summary.text,summaryComplete:summary.complete,date:article.original_published_at||entry.date,url:canonical,image:photo.url,imageType:image.mimeType,width:metadata.width,height:metadata.height,credit:photo.credit||article.cover_credit||'',source:preset.name});
}
const pool=new Pool({connectionString:secureConnectionString(process.env.DATABASE_URL),connectionTimeoutMillis:8000,statement_timeout:10000});
try{
 const existing=(await pool.query(`SELECT canonical_url AS url FROM source_news_items WHERE canonical_url=ANY($1::text[]) UNION SELECT source_url FROM news WHERE source_url=ANY($1::text[]) UNION SELECT canonical_url FROM news_origin_tombstones WHERE canonical_url=ANY($1::text[])`,[eligible.map(e=>e.url)])).rows;
 const report={method:'RSS oficiales por editoria + HTML público para fotografía/créditos',identified:entries.length,eligible:eligible.length,existingDuplicates:existing.length,samples,articlesWritten:0,photosUploaded:0,activated:false};
 if(args.includes('--activate')){
  const client=await pool.connect();try{
   await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await client.query('SELECT pg_advisory_xact_lock(84201916)');
   const categories=(await client.query("SELECT slug FROM categories WHERE active AND slug=ANY($1::text[])",[['uruguay','mundo','cultura','deportes']])).rows;
   if(categories.length!==4)throw Error('As quatro categorias UPOST devem estar ativas.');
   const policy=(await client.query('SELECT global_daily_limit,min_sync_minutes FROM news_retention_policy WHERE id=true')).rows[0];if(!policy)throw Error('Retenção não configurada.');
   const existingSource=(await client.query("SELECT r.id,r.active,a.enabled FROM portal_resources r LEFT JOIN source_automation a ON a.resource_id=r.id WHERE r.url=$1",[preset.url])).rows[0];
   if(existingSource){report.activated=Boolean(existingSource.active&&existingSource.enabled);report.alreadyRegistered=true;}
   else{
    const owner=(await client.query("SELECT id FROM users WHERE role='OWNER' AND active AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1")).rows[0]?.id;if(!owner)throw Error('Propietario ativo não encontrado.');
    const before=(await client.query("SELECT count(*)::int AS count,md5(COALESCE(string_agg(to_jsonb(r)::text||COALESCE(to_jsonb(a)::text,''),'' ORDER BY r.id),'')) AS hash FROM portal_resources r LEFT JOIN source_automation a ON a.resource_id=r.id WHERE r.kind IN ('source','partner')")).rows[0];
    const newsBefore=(await client.query('SELECT count(*)::int AS count FROM news')).rows[0].count,id=randomUUID();
    await client.query("INSERT INTO portal_resources(id,kind,name,url,description,feed_url,category_slug,active,display_order) VALUES($1,'source',$2,$3,$4,$5,$6,true,30)",[id,preset.name,preset.url,preset.description,preset.feed,preset.category]);
    await client.query("INSERT INTO source_automation(resource_id,enabled,interval_minutes,max_items,daily_limit,publication_mode,content_mode,next_sync_at) VALUES($1,true,$2,4,5,'automatic','summary',now()+$3*interval '1 minute')",[id,Math.min(1440,Math.max(60,policy.min_sync_minutes)),Math.max(60,policy.min_sync_minutes)]);
    const after=(await client.query("SELECT count(*)::int AS count,md5(COALESCE(string_agg(to_jsonb(r)::text||COALESCE(to_jsonb(a)::text,''),'' ORDER BY r.id),'')) AS hash FROM portal_resources r LEFT JOIN source_automation a ON a.resource_id=r.id WHERE r.kind IN ('source','partner') AND r.id<>$1",[id])).rows[0];
    if(JSON.stringify(before)!==JSON.stringify(after)||(await client.query('SELECT count(*)::int AS count FROM news')).rows[0].count!==newsBefore)throw Error('Dados preexistentes divergiram.');
    await client.query("INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES($1,'source.configure','portal_resources',$2,$3)",[owner,id,JSON.stringify({source:preset.url,method:'official-rss',publicationMode:'automatic',contentMode:'summary',globalLimitUnchanged:policy.global_daily_limit})]);
    report.activated=true;report.globalLimit=policy.global_daily_limit;report.existingSourcesPreserved=true;
   }
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 await writeFile(`${directory}/result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({identified:report.identified,eligible:report.eligible,existingDuplicates:report.existingDuplicates,validatedCategories:samples.map(s=>s.category),articlesWritten:0,photosUploaded:0,activated:report.activated,alreadyRegistered:report.alreadyRegistered||false,globalLimit:report.globalLimit,existingSourcesPreserved:report.existingSourcesPreserved}));
}finally{await pool.end();}
