import test from 'node:test';
import assert from 'node:assert/strict';
import { portalClock,resolveSchedule,daySchedule } from '../lib/programming/engine.mjs';
import { chatText } from '../lib/programming/chat-input.mjs';
const program={id:'p',name:'Programa',active:true};
const slot={id:'s',weekday:1,start_time:'08:00:00',end_time:'12:00:00',active:true,program};
test('fuso explícito e virada do dia independem do servidor',()=>{
 assert.deepEqual(portalClock(new Date('2026-09-28T02:30:00Z'),'America/Sao_Paulo'),{date:'2026-09-27',time:'23:30',weekday:0});
 assert.equal(portalClock(new Date('2026-09-28T02:30:00Z'),'Asia/Tokyo').date,'2026-09-28');
});
test('programa atual, próximo, limites consecutivos e próxima semana',()=>{
 const slots=[slot,{...slot,id:'next',start_time:'12:00:00',end_time:'14:00:00'}];
 const at=resolveSchedule(slots,[],'America/Sao_Paulo',new Date('2026-09-28T11:00:00Z'));
 assert.equal(at.current.id,'s');assert.equal(at.next[0].id,'next');
 assert.equal(resolveSchedule(slots,[],'America/Sao_Paulo',new Date('2026-09-28T15:00:00Z')).current.id,'next');
 const after=resolveSchedule(slots,[],'America/Sao_Paulo',new Date('2026-09-28T18:00:00Z'));assert.equal(after.current,null);assert.equal(after.next[0].date,'2026-10-05');
});
test('exceção sobrepõe apenas seu intervalo; cancelamento preserva restante',()=>{
 const exception={id:'e',date:'2026-09-28',start_time:'09:00',end_time:'10:00',active:true,program:{...program,id:'special'}};
 const rows=daySchedule('2026-09-28',[slot],[exception]);
 assert.deepEqual(rows.map(s=>[s.start_time,s.end_time]),[['08:00','09:00'],['09:00','10:00'],['10:00','12:00']]);
 assert.equal(rows[1].program.id,'special');
 assert.equal(daySchedule('2026-09-28',[slot],[{...exception,cancelled:true}]).length,2);
 assert.equal(daySchedule('2026-09-29',[slot],[exception]).length,0);
});
test('inativos não aparecem e exceção inativa não substitui grade',()=>{
 assert.equal(daySchedule('2026-09-28',[{...slot,program:{...program,active:false}}],[]).length,0);
 assert.equal(daySchedule('2026-09-28',[{...slot,active:false}],[]).length,0);
 assert.equal(daySchedule('2026-09-28',[slot],[{date:'2026-09-28',active:false}]).length,1);
});
test('chat rejeita vazio, limites e conteúdo executável',()=>{
 for(const input of ['', '   ','<script>alert(1)</script>','x'.repeat(501)])assert.throws(()=>chatText(input,500));
 assert.throws(()=>chatText('x'.repeat(41),40));
 assert.equal(chatText('<b>Olá</b><iframe src="evil"></iframe>',500),'Olá');
 assert.equal(chatText('x'.repeat(500),500).length,500);
});
