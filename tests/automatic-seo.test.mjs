import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {automaticSeo,generatedSeo,seoChanges} from '../lib/editorial/automatic-seo.mjs';
import {seoBatch} from '../lib/editorial/seo-backfill.mjs';
const stub=code=>({url:'data:text/javascript,'+encodeURIComponent(code),shortCircuit:true});
registerHooks({resolve(s,c,next){
 if(s==='server-only')return stub('export {}');
 if(s==='@/lib/db/pool')return stub('export function getPool(){return globalThis.seoPool}');
 if(s==='./editorial-media')return stub('export async function assertEditorialImage(){}');
 if(s==='./news-lifecycle')return stub('export async function retentionPolicy(){return {ready:false,policy:{}}} export async function importBudget(){return {ready:true,remaining:5,policy:{}}} export async function registerAutomaticNews(){} export async function registerNewsRetention(){} export async function editorialLifecycle(){}');
 if(s.startsWith('@/')||(s.startsWith('.')&&!c.parentURL?.includes('/node_modules/'))){const base=s.startsWith('@/')?new URL('../'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of['','.ts','.mjs']){const url=new URL(base.href+ext);if(existsSync(url))return next(url.href,c);}}
 return next(s,c);
}});
test('deterministic descriptions strip formatting, decode entities and use real content only',()=>{
 const seo=generatedSeo({title:'Uruguay &amp; cultura | UPOST.uy',body:'## Cultura\n\nUna **historia real** de Montevideo. '.repeat(10)});
 assert.equal(seo.seo_title,'Uruguay & cultura | UPOST.uy');assert.ok(seo.seo_description.length<=160);assert.doesNotMatch(seo.seo_description,/<|\*\*/);
 assert.equal(generatedSeo({title:'Solo título',excerpt:'   ',body:'Texto del artículo.'}).seo_description,'Texto del artículo.');
});
test('automatic fields update on edits; custom legacy SEO and canonical/slug stay untouched',()=>{
 const before={title:'Título anterior',excerpt:'Resumen anterior',slug:'original',canonical_url:'https://source.example/original'};
 Object.assign(before,generatedSeo(before));const next={...before,title:'Título nuevo',excerpt:'Resumen nuevo'};
 assert.equal(automaticSeo(before,next,next).seo_description,'Resumen nuevo');
 const custom={...before,seo_title:'Selección editorial',seo_description:'Descripción elegida a mano.'};
 assert.equal(automaticSeo(custom,{...custom,title:'Cambio'},{...custom}).seo_title,custom.seo_title);
 assert.deepEqual(automaticSeo(custom),{seo_title:custom.seo_title,seo_description:custom.seo_description});assert.equal(seoChanges(custom),null);
 assert.equal(before.slug,'original');assert.equal(before.canonical_url,'https://source.example/original');
 assert.notEqual(automaticSeo({...before,seo_title:'Noticias de Uruguay y el mundo'}).seo_title,'Noticias de Uruguay y el mundo');
});
test('backfill is resumable, dry-run does not write and applied rows are idempotent',async()=>{
 const row={id:'00000000-0000-4000-8000-000000000001',version:1,title:'Nota real',excerpt:'Resumen real',seo_title:'',seo_description:''},sql=[];
 const db={query:async(q,v)=>{sql.push(q);if(q.startsWith('SELECT n.*'))return{rows:[row]};if(q.startsWith('UPDATE')){Object.assign(row,{seo_title:v[0],seo_description:v[1],version:2});return{rowCount:1};}return{rows:[],rowCount:1};}};
 const dry=await seoBatch(db,{kind:'news'});assert.equal(dry.changed,1);assert.equal(dry.after,row.id);assert.equal(sql.some(q=>/^(INSERT|UPDATE|DELETE)/.test(q)),false);
 assert.equal((await seoBatch(db,{kind:'news',apply:true})).changed,1);assert.equal((await seoBatch(db,{kind:'news',apply:true})).changed,0);
 assert.ok(sql.filter(q=>q.startsWith('UPDATE')).every(q=>!/(?:slug|body|updated_at|cover_image)\s*=/.test(q)));
});
test('metadata has canonical, social cards, safe images and truthful video structured data',async()=>{
 const {newsMetadata,videoMetadata,videoStructuredData,jsonLd}=await import('../lib/editorial/seo.ts');
 const news={title:'Noticia',excerpt:'Información real.',seo_title:'',seo_description:'',slug:'original',canonical_url:'',cover_image:'/media/photo.webp',cover_alt:'Foto real',author_name:'Periodista',visible_at:new Date('2026-11-01'),updated_at:new Date('2026-11-02')};
 const meta=newsMetadata(news);assert.match(meta.alternates.canonical,/\/noticias\/original$/);assert.equal(meta.openGraph.title,meta.title);assert.equal(meta.twitter.card,'summary_large_image');
 assert.equal(newsMetadata({...news,cover_image:'javascript:bad'}).twitter.card,'summary');
 const video={id:'a',title:'Entrevista',description:'Conversación real.',published_at:new Date('2026-11-01'),thumbnail_url:'/media/photo.webp',video_url:'https://youtu.be/abcdefghijk'};
 assert.match(videoMetadata(video).alternates.canonical,/\/videos\?video=a$/);const data=videoStructuredData(video);assert.equal(data['@type'],'VideoObject');assert.match(data.embedUrl,/abcdefghijk$/);assert.equal('duration' in data,false);assert.equal(videoStructuredData({...video,thumbnail_url:''}),null);assert.doesNotMatch(jsonLd({text:'</script>'}),/<\/script>/);
});

function mockSave(){
 const state={news:null,video:null};const actor='00000000-0000-4000-8000-000000000001';
 const query=async(sql,values=[])=>{
  if(sql.startsWith('SELECT * FROM news WHERE'))return{rows:state.news?[state.news]:[]};
  if(/SELECT \*\s+FROM videos\s+WHERE id/.test(sql))return{rows:state.video?[state.video]:[]};
  if(sql.includes('SELECT active,photo_url FROM authors'))return{rows:[{active:true,photo_url:''}]};
  if(sql.includes('SELECT id,active FROM categories'))return{rows:[{id:actor,active:true}],rowCount:1};
  if(sql.startsWith('SELECT category_id'))return{rows:[{category_id:actor}]};
  if(sql.startsWith('INSERT INTO news(')||sql.startsWith('UPDATE news SET')){
   const names=sql.startsWith('INSERT')?sql.match(/news\((.*?)\)/)[1].split(','):sql.match(/SET (.*?),updated_by=/)[1].split(',').map(s=>s.split('=')[0]);
   state.news={...state.news,...Object.fromEntries(names.map((n,i)=>[n,values[i]])),id:state.news?.id||values[values.length-2],version:(state.news?.version||0)+1};
  }
  if(/(?:INSERT INTO videos\(|UPDATE videos\s+SET)/.test(sql)){
   const names=['id','title','slug','description','thumbnail_url','video_url','source','status','featured','published_at','seo_title','seo_description'];state.video={...Object.fromEntries(names.map((n,i)=>[n,values[i]])),version:(state.video?.version||0)+1};
  }
  return{rows:[],rowCount:1};
 };globalThis.seoPool={query,connect:async()=>({query,release(){}})};return{state,actor};
}
test('real news save path generates SEO on creation, edit and automated source import',async()=>{
 const {saveNews}=await import('../server/services/editorial.ts');const {state,actor}=mockSave();
 const form=new FormData();for(const[k,v]of Object.entries({title:'Noticia real',body:'Texto real.',excerpt:'Resumen original.',author_id:actor,status:'PUBLISHED',slug:'url-original'}))form.set(k,v);form.append('category_ids',actor);
 await saveNews(form,actor);assert.equal(state.news.seo_description,'Resumen original.');
 form.set('id',state.news.id);form.set('version','1');form.set('title','Noticia editada');form.set('excerpt','Nuevo resumen.');form.set('seo_title',state.news.seo_title);form.set('seo_description',state.news.seo_description);
 await saveNews(form,actor);assert.equal(state.news.seo_description,'Nuevo resumen.');assert.equal(state.news.slug,'url-original');
 form.delete('id');form.set('source_url','https://source.example/nota');form.set('seo_title','Texto de origen');await saveNews(form,actor,{resourceId:actor,identifier:'rss-item'});assert.equal(state.news.seo_title,'Noticia editada | UPOST.uy');
});
test('real video save path generates and refreshes SEO while preserving manual overrides',async()=>{
 const {saveVideo}=await import('../server/services/videos.ts');const {state,actor}=mockSave();
 const form=new FormData();for(const[k,v]of Object.entries({title:'Video real',description:'Descripción original.',video_url:'https://youtu.be/abcdefghijk',status:'PUBLISHED',slug:'video-original'}))form.set(k,v);
 await saveVideo(form,actor);assert.equal(state.video.seo_description,'Descripción original.');
 form.set('id',state.video.id);form.set('version','1');form.set('description','Descripción nueva.');form.set('seo_title',state.video.seo_title);form.set('seo_description',state.video.seo_description);
 await saveVideo(form,actor);assert.equal(state.video.seo_description,'Descripción nueva.');assert.equal(state.video.slug,'video-original');
 form.set('version','2');form.set('seo_title','Título elegido a mano');await saveVideo(form,actor);assert.equal(state.video.seo_title,'Título elegido a mano');
});
