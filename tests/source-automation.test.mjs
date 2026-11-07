import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import{existsSync}from'node:fs';
const stub=code=>({url:'data:text/javascript,'+encodeURIComponent(code),shortCircuit:true});
const remote=new URL('../lib/security/remote-page.mjs',import.meta.url).href;
registerHooks({resolve(specifier,context,next){
 if(specifier==='server-only')return stub('export {}');
 if(specifier==='@/lib/db/pool')return stub('export function getPool(){return globalThis.syncTest.pool}');
 if(specifier==='./news-lifecycle'&&context.parentURL?.endsWith('/source-automation.ts'))return stub('export async function retentionPolicy(){return {ready:true,policy:{min_sync_minutes:60}}} export async function importBudget(){return {ready:true,remaining:globalThis.syncTest.budget??5}}');
 if(specifier==='@/lib/security/remote-page.mjs')return stub(`export {remoteUrl} from ${JSON.stringify(remote)};export async function fetchRemoteFeed(){return globalThis.syncTest.feed()}export async function fetchRemotePage(url){return globalThis.syncTest.page(url)}`);
 if(specifier==='./import-editorial-image'&&context.parentURL?.endsWith('/source-automation.ts'))return stub('export async function importEditorialImage(url){if(globalThis.syncTest.imageFails||globalThis.syncTest.failedImages?.has(url))throw Error("image unavailable");return "/media/00000000-0000-4000-8000-000000000001.webp"}');
 if(specifier==='./editorial'&&context.parentURL?.endsWith('/source-automation.ts'))return stub('export async function saveNews(form,user,sourceImport){if(!sourceImport?.identifier)throw Error("missing source identity");return globalThis.syncTest.save(form)}export async function saveTaxonomy(){return "author"}');
 if(specifier.startsWith('@/')||(specifier.startsWith('.')&&!context.parentURL?.includes('/node_modules/'))){const base=specifier.startsWith('@/')?new URL('../'+specifier.slice(2),import.meta.url):new URL(specifier,context.parentURL);for(const suffix of ['','.ts','.mjs']){const url=new URL(base.href+suffix);if(existsSync(url))return next(url.href,context);}}
 return next(specifier,context);
}});
const {synchronizeSources}=await import('../server/services/source-automation.ts');
function setup(mode='automatic'){
 const date=new Date(Date.now()-60000).toISOString();
 const s={locked:false,seen:new Set(),saved:[],updates:[],imageFails:false,source:{resource_id:'source',name:'Fuente de prueba',url:'https://example.com/',feed_url:'https://example.com/rss',category_slug:'mundo',max_items:3,publication_mode:mode,content_mode:'summary',keywords:''}};
 s.feed=async()=>({html:`<rss><channel><item><guid>one</guid><title>Noticia verificable</title><link>https://example.com/a</link><pubDate>${date}</pubDate><description>Resumen fiel de la publicación.</description></item></channel></rss>`});
 s.page=async url=>({url,html:`<link rel="canonical" href="https://example.com/canonical"><meta property="og:title" content="Noticia verificable"><meta name="description" content="Resumen fiel de la publicación."><meta property="article:published_time" content="${date}"><meta property="og:image" content="https://example.com/a.jpg"><article><p>${'Cuerpo disponible de la noticia. '.repeat(15)}</p></article>`});
 s.save=async form=>{s.saved.push(Object.fromEntries(form));s.seen.add(form.get('source_url'));return 'news';};
 let ownsLock=false;
 const client={async query(sql,values=[]){
  if(sql.includes('pg_try_advisory_xact_lock')){const locked=!s.locked;if(locked){s.locked=true;ownsLock=true;}return{rows:[{locked}]};}
  if(sql==='ROLLBACK'&&ownsLock){s.locked=false;ownsLock=false;}
  if(sql.includes('FROM users'))return{rows:[{id:'owner'}]};
  if(sql.includes('SELECT a.*,r.name'))return{rows:[s.source]};
  if(sql.includes('SELECT 1 FROM source_news_items'))return{rows:[],rowCount:values.some(v=>s.seen.has(v))?1:0};
  if(sql.includes('FROM authors'))return{rows:[{id:'author',active:true}]};
  if(sql.includes('FROM categories'))return{rows:[{id:'category'}]};
  if(sql.startsWith('UPDATE source_automation'))s.updates.push(values);
  return{rows:[],rowCount:1};
 },release(){}};
 s.pool={query:client.query,async connect(){return client;}};globalThis.syncTest=s;return s;
}
test('automatic synchronization imports through editor/media and repeated schedule skips canonical duplicate',async()=>{
 const s=setup();const first=await synchronizeSources();assert.equal(first.results[0].imported,1);assert.equal(s.saved[0].status,'PUBLISHED');assert.equal(s.saved[0].source_name,'Fuente de prueba');assert.match(s.saved[0].body,/Leé la información original/);assert.match(s.saved[0].cover_image,/^\/media\//);
 const again=await synchronizeSources();assert.equal(again.results[0].duplicates,1);assert.equal(s.saved.length,1);assert.equal(s.locked,false);
});
test('review creates editable drafts with photographs; failed photographs do not create visually incomplete news',async()=>{
 let s=setup('review');let r=await synchronizeSources();assert.equal(r.results[0].imported,1);assert.equal(s.saved[0].status,'DRAFT');
 s=setup('review');s.imageFails=true;r=await synchronizeSources();assert.equal(r.results[0].errors,1);assert.equal(s.saved.length,0);
});
test('no RSS uses public listing and the same URL importer',async()=>{
 const s=setup();s.source.feed_url='';const article=s.page;s.page=async url=>url===s.source.url?{url,html:'<main><h3><a href="/a">Noticia verificable</a></h3></main>'}:article(url);
 assert.equal((await synchronizeSources()).results[0].imported,1);
});
test('a missing photograph is logged and the next recent story is attempted within the configured limit',async()=>{
 const s=setup();s.failedImages=new Set(['https://example.com/a.jpg']);const date=new Date(Date.now()-60000).toISOString();
 s.feed=async()=>({html:`<rss><channel>${['a','b'].map(id=>`<item><guid>${id}</guid><title>Noticia verificable ${id}</title><link>https://example.com/${id}</link><pubDate>${date}</pubDate><description>Resumen fiel de la publicación.</description></item>`).join('')}</channel></rss>`});
 const original=s.page;s.page=async url=>{const page=await original(url);return {...page,html:page.html.replace('https://example.com/canonical',url).replace('https://example.com/a.jpg',url+'.jpg')};};
 s.source.max_items=1;const result=await synchronizeSources();assert.equal(result.results[0].imported,1);assert.equal(result.results[0].errors,1);assert.equal(s.saved.length,1);assert.equal(s.saved[0].source_url,'https://example.com/b');
});
test('source unavailable yields an objective error, no news and releases lock',async()=>{
 const s=setup();s.feed=async()=>{throw Error('La fuente no permitió acceder a la página.');};const r=await synchronizeSources();assert.equal(r.results[0].status,'error');assert.equal(s.saved.length,0);assert.equal(s.locked,false);assert.match(s.updates[0][3],/permitió/);
});
test('scheduler and manual synchronization share a nonblocking lock',async()=>{
 const s=setup();s.locked=true;assert.equal((await synchronizeSources('source')).busy,true);assert.equal(s.saved.length,0);assert.equal(s.locked,true);
});
test('daily budget and the effective minimum interval prevent downloads before imports',async()=>{
 let s=setup();s.budget=0;s.feed=async()=>{throw Error('must not download');};let result=await synchronizeSources();assert.equal(result.results.length,0);assert.equal(s.saved.length,0);
 s=setup();s.source.interval_minutes=30;s.source.last_sync_at=new Date(Date.now()-30*60000);s.feed=async()=>{throw Error('must not download');};result=await synchronizeSources('source');assert.equal(result.results.length,0);assert.equal(s.saved.length,0);
});
test('full automatic import with no photograph is rejected instead of being published',async()=>{
 const s=setup();s.source.content_mode='full';s.imageFails=true;
 assert.equal((await synchronizeSources()).results[0].errors,1);assert.equal(s.saved.length,0);
});
test('incomplete full extraction is not published; public feed can be used for summary-only imports',async()=>{
 let s=setup();s.source.content_mode='full';s.page=async()=>({url:'https://example.com/a',html:'<article><h1>Noticia verificable</h1><p>Incompleto</p></article>'});assert.equal((await synchronizeSources()).results[0].errors,1);assert.equal(s.saved.length,0);
 s=setup();s.page=async()=>{throw Error('La fuente no permitió acceder a la página.');};assert.equal((await synchronizeSources()).results[0].imported,0);assert.equal(s.saved.length,0);
});
