import test from 'node:test';import assert from 'node:assert/strict';import{registerHooks}from'node:module';import{existsSync}from'node:fs';
const stub=code=>({url:'data:text/javascript,'+encodeURIComponent(code),shortCircuit:true});
const remote=new URL('../lib/security/remote-page.mjs',import.meta.url).href;
registerHooks({resolve(s,c,next){
 if(s==='server-only')return stub('export {}');
 if(s==='next/cache')return stub('export function revalidatePath(){}');
 if(s==='@/lib/auth/operations')return stub('export async function operationsMutation(){if(!globalThis.controls.authorized)throw Error("unauthorized");return {id:"owner"}}');
 if(s==='@/lib/db/pool')return stub('export function getPool(){return globalThis.controls.pool}');
 if(s==='@/server/services/source-automation')return stub('export async function automationData(){return {ready:globalThis.controls.ready,items:[]}}export async function synchronizeSources(){throw Error("not activated")}');
 if(s==='@/server/services/editorial')return stub('export async function saveTaxonomy(){return "category"}');
 if(s==='@/server/services/editorial-media')return stub('export async function assertEditorialImage(){}');
 if(s==='@/lib/security/remote-page.mjs')return stub(`export {remoteUrl} from ${JSON.stringify(remote)};export async function fetchRemoteFeed(url){return globalThis.controls.fetch(url)}export async function fetchRemotePage(url){return globalThis.controls.fetch(url)}`);
 if(s.startsWith('@/')||(s.startsWith('.')&&!c.parentURL?.includes('/node_modules/'))){const base=s.startsWith('@/')?new URL('../'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['','.ts','.mjs']){const u=new URL(base.href+ext);if(existsSync(u))return next(u.href,c);}}
 return next(s,c);
}});
const {configureInitialSources}=await import('../app/admin/resource-actions.ts');
function setup(){
 const state={ready:false,authorized:true,queries:[],existing:false,fail:false};
 state.fetch=async url=>{if(state.fail)throw Error('La fuente no permitió acceder a la página.');return {url,html:url.includes('gub.uy')?'<main><h3><a href="/presidencia/comunicacion/noticias/real">Comunicado oficial</a></h3></main>':`<rss><channel><item><title>Noticia verificable</title><link>${new URL('/news',url)}</link></item></channel></rss>`};};
 state.pool={async query(sql,values){state.queries.push({sql,values});if(sql.includes('FROM categories'))return{rows:[{id:'category'}]};if(sql.startsWith('SELECT id FROM portal_resources'))return{rows:state.existing?[{id:'existing'}]:[]};return{rows:[],rowCount:1};}};
 globalThis.controls=state;return state;
}
test('initial sources can be registered in existing tables while 010 is pending; no automatic migration or public activation',async()=>{
 const s=setup();const result=await configureInitialSources();assert.equal(result.ok,true);
 assert.equal(s.queries.filter(q=>q.sql.startsWith('INSERT INTO portal_resources')).length,3);
 assert.equal(s.queries.some(q=>q.sql.includes('INSERT INTO source_automation')),false);
 assert.equal(s.queries.some(q=>/CREATE|ALTER|DROP|INSERT INTO news\b/.test(q.sql)),false);
 assert.ok(s.queries.filter(q=>q.sql.startsWith('INSERT INTO portal_resources')).every(q=>q.sql.includes('false)')));
 assert.match(result.message,/La automatización requiere activar la base de datos/);
});
test('single-source registration preserves existing records and fails clearly without creating fake sources',async()=>{
 let s=setup();s.existing=true;const form=new FormData();form.set('initial_source','https://www.xataka.com/');await configureInitialSources(form);assert.equal(s.queries.filter(q=>q.sql.startsWith('INSERT INTO portal_resources')).length,0);
 s=setup();s.fail=true;const result=await configureInitialSources(form);assert.match(result.message,/no configurada/);assert.equal(s.queries.length,0);
 s=setup();s.authorized=false;await assert.rejects(configureInitialSources(),/unauthorized/);assert.equal(s.queries.length,0);
});
