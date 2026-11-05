import test from 'node:test';import assert from 'node:assert/strict';import {distributeNews} from '../lib/editorial/distribution.mjs';
const item=(id,extra={})=>({id:String(id),visible_at:'2026-11-03T12:00:00Z',categories:[{slug:'opinion',active:true},{slug:'cultura',active:true}],...extra});
test('editorial distribution reserves the lead and never duplicates multi-category articles',()=>{
 const result=distributeNews([...Array.from({length:20},(_,id)=>item(id)),item(0)]);
 const ids=[...result.lead,...result.more,...result.blocks.flatMap(b=>b.items)].map(n=>n.id);
 assert.equal(ids.length,new Set(ids).size);assert.equal(result.lead.length,7);
 assert.equal(result.blocks.find(b=>b.slug==='opinion').items.length,3);
 assert.equal(result.blocks.find(b=>b.slug==='cultura').items.length,3);
});
test('urgent and editorially featured articles precede recent articles; sparse editions remain valid',()=>{
 const result=distributeNews([item(1),item(2,{featured:true}),item(3,{urgent:true})]);assert.deepEqual(result.lead.map(n=>n.id),['3','2','1']);assert.equal(result.more.length,0);assert.deepEqual(distributeNews([]).lead,[]);
});
