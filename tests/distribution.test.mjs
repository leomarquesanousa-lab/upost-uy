import test from 'node:test';import assert from 'node:assert/strict';import {distributeNews} from '../lib/editorial/distribution.mjs';
const item=(id,extra={})=>({id:String(id),visible_at:'2026-11-03T12:00:00Z',categories:[{slug:'opinion',active:true},{slug:'cultura',active:true}],...extra});
test('editorial distribution reserves the lead and never duplicates multi-category articles',()=>{
 const result=distributeNews([...Array.from({length:20},(_,id)=>item(id)),item(0)]);
 const ids=[...result.lead,...result.more,...result.blocks.flatMap(b=>b.items)].map(n=>n.id);
 assert.equal(ids.length,new Set(ids).size);assert.equal(result.lead.length,7);
 assert.equal(ids.length,20);
});
test('urgent and editorially featured articles precede recent articles; sparse editions remain valid',()=>{
 const result=distributeNews([item(1),item(2,{featured:true}),item(3,{urgent:true})]);assert.deepEqual(result.lead.map(n=>n.id),['3','2','1']);assert.equal(result.more.length,0);assert.deepEqual(distributeNews([]).lead,[]);
});
test('manual principal wins over featured imports and current blocks remain chronological',()=>{
 const items=Array.from({length:50},(_,id)=>item(id,{visible_at:new Date(Date.UTC(2026,10,10)-id*60000).toISOString(),categories:[{slug:'economia',name:'Economía',active:true}]}));
 items[40].home_lead=true;items[0].urgent=true;items[1].featured=true;
 const result=distributeNews(items);
 assert.equal(result.lead[0].id,'40');
 const all=[...result.lead,...result.more,...result.blocks.flatMap(b=>b.items)];
 assert.equal(all.length,50);assert.equal(new Set(all.map(n=>n.id)).size,50);
 for(const group of [result.more,...result.blocks.map(b=>b.items)])assert.deepEqual(group.map(n=>n.visible_at),group.map(n=>n.visible_at).sort().reverse());
});
test('original ordering preserves the manual lead without adding photo-based rearrangements',()=>{
 const result=distributeNews([item(1,{home_lead:true}),item(2,{cover_image:'/media/photo.webp'}),item(3,{cover_image:'/brand/logo.svg'}),item(4,{cover_image:'/media/portrait.webp'})]);
 assert.deepEqual(result.lead.map(n=>n.id),['1','2','3','4']);
});
test('real categories are ordered Uruguay, Mundo, Deportes, then other desks without duplicates or per-category caps',()=>{
 const cats=[{slug:'uruguay',name:'Uruguay',active:true},{slug:'mundo',name:'Mundo',active:true},{slug:'deportes',name:'Deportes',active:true},{slug:'economia',name:'Economía',active:true}];
 const items=Array.from({length:55},(_,i)=>item(i,{visible_at:new Date(Date.UTC(2026,10,10)-i*1000).toISOString(),categories:i<7?[]:i%5===0?[cats[3]]:[cats[i%4],cats[(i+1)%4]]}));
 const result=distributeNews(items);
 assert.deepEqual(result.blocks.map(b=>b.slug),['uruguay','mundo','deportes','economia']);
 const all=[...result.lead,...result.blocks.flatMap(b=>b.items),...result.more];assert.equal(all.length,55);assert.equal(new Set(all.map(n=>n.id)).size,55);
 assert.ok(result.blocks[0].items.length>3);
 for(const b of result.blocks){assert.ok(b.items.every(n=>n.categories.some(c=>c.active&&c.slug===b.slug)));assert.deepEqual(b.items.map(n=>n.visible_at),b.items.map(n=>n.visible_at).sort().reverse());}
});
