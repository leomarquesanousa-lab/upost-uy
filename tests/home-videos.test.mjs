import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
const stub=code=>({url:'data:text/javascript,'+encodeURIComponent(code),shortCircuit:true});
registerHooks({resolve(s,c,next){
 if(s==='server-only')return stub('export {}');
 if(s==='@/lib/db/pool')return stub('export function getPool(){return {query:async(sql)=>{globalThis.videoQuery=sql;return {rows:[]}}}}');
 if(s.startsWith('@/')||(s.startsWith('.')&&!c.parentURL?.includes('/node_modules/'))){const base=s.startsWith('@/')?new URL('../'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of['','.ts','.mjs']){const url=new URL(base.href+ext);if(existsSync(url))return next(url.href,c);}}
 return next(s,c);
}});
test('homepage video query is bounded, public-only and chronological without featured priority',async()=>{
 const {publishedVideos}=await import('../server/services/videos.ts');
 await publishedVideos({home:true});const home=globalThis.videoQuery;
 assert.match(home,/status='PUBLISHED'/);assert.match(home,/deleted_at IS NULL/);assert.match(home,/published_at <= now\(\)/);assert.match(home,/LIMIT 3/);
 assert.match(home,/ORDER BY\s+published_at DESC NULLS LAST,\s+created_at DESC,id/);assert.doesNotMatch(home,/featured DESC/);
 await publishedVideos();assert.match(globalThis.videoQuery,/featured DESC/);assert.doesNotMatch(globalThis.videoQuery,/LIMIT 3/);
});
