import test from 'node:test';
import assert from 'node:assert/strict';
import {canManageUser,validatePassword,destinationUrl,selectCampaign,ctr,localDateTime} from '../lib/admin/policy.mjs';
test('privilégios: OWNER total, ADMIN protege OWNER, EDITOR não gerencia usuários',()=>{
 assert.equal(canManageUser('OWNER','OWNER','EDITOR'),true);
 assert.equal(canManageUser('ADMIN','EDITOR','ADMIN'),true);
 assert.equal(canManageUser('ADMIN','OWNER','EDITOR'),false);
 assert.equal(canManageUser('ADMIN','ADMIN','OWNER'),false);
 assert.equal(canManageUser('EDITOR','EDITOR','EDITOR'),false);
});
test('política de senha e confirmação',()=>{assert.throws(()=>validatePassword('curta','curta'));assert.throws(()=>validatePassword('senha muito longa','outra'));assert.equal(validatePassword('senha segura com espaços','senha segura com espaços'),'senha segura com espaços');});
test('destinos somente HTTP(S), sem credenciais',()=>{for(const u of ['javascript:alert(1)','data:text/html,bad','file:///tmp/a','ftp://host','https://user:pass@example.org'])assert.throws(()=>destinationUrl(u));assert.equal(destinationUrl('https://example.org'),'https://example.org/');});
test('veiculação respeita datas e atividade, prioridade e rotação de empates',()=>{
 const now=Date.parse('2026-09-27T12:00:00Z');const base={id:'a',active:true,start_at:'2026-09-26T00:00:00Z',end_at:null,priority:1};
 for(const c of [{...base,active:false},{...base,start_at:'2027-01-01'},{...base,end_at:'2026-09-27T12:00:00Z'}])assert.equal(selectCampaign([c],now),null);
 assert.equal(selectCampaign([base,{...base,id:'b',priority:2}],now).id,'b');
 const options=[base,{...base,id:'b'}];assert.notEqual(selectCampaign(options,now).id,selectCampaign(options,now+60000).id);
 assert.equal(selectCampaign([],now),null);
});
test('CTR seguro e data local no fuso explícito',()=>{assert.equal(ctr(1,0),0);assert.equal(ctr('5','100'),5);assert.equal(localDateTime('2026-09-28T01:00:00Z','America/Sao_Paulo'),'2026-09-27T22:00');});
