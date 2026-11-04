'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { programmingAction } from '@/app/admin/programming-actions';
import type { Kind,Presenter,Program,Slot } from '@/server/services/programming';
import { days } from '@/lib/programming/engine.mjs';
type RecordValue=Partial<Presenter & Program & Slot>;
export function ProgrammingForm({kind,record={},presenters=[],programs=[],destination}:{kind:Kind;record?:RecordValue;presenters?:Presenter[];programs?:Program[];destination?:string}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);const router=useRouter();
 const schedule=kind==='schedule_slots'||kind==='schedule_exceptions';
 async function submit(form:FormData){setBusy(true);setError('');const result=await programmingAction(kind,form);setBusy(false);if(result.error)setError(result.error);else{if(destination)router.push(destination);router.refresh();setError('Salvo com sucesso.');}}
 const input=(name:keyof RecordValue,label:string,max=120)=> <label key={name}>{label}<input name={name} defaultValue={String(record[name]??'')} maxLength={max} required={name==='name'}/></label>;
 return <form action={submit} className="phase-form">{record.id&&<input type="hidden" name="id" value={record.id}/>}
 {!schedule?<>{input('name','Nome')}{input('slug','Slug (opcional)',180)}{kind==='presenters'?<><label>Biografia<textarea name="bio" defaultValue={record.bio} maxLength={10000}/></label>{input('photo_url','URL da foto',2048)}{input('social_instagram','Instagram',2048)}{input('social_facebook','Facebook',2048)}{input('social_x','X',2048)}</>:<>{input('short_description','Descrição curta',400)}<label>Descrição<textarea name="description" defaultValue={record.description} maxLength={10000}/></label>{input('cover_image','URL da imagem',2048)}<fieldset><legend>Apresentadores</legend>{presenters.map(p=><label key={p.id} className="check"><input type="checkbox" name="presenter_ids" value={p.id} defaultChecked={record.presenters?.some(a=>a.id===p.id)}/>{p.name}{!p.active?' (inativo)':''}</label>)}</fieldset></>}</>:<>
 {kind==='schedule_slots'?<label>Dia da semana<select aria-label="Dia da semana" name="weekday" defaultValue={record.weekday??1}>{[1,2,3,4,5,6,0].map(d=><option key={d} value={d}>{days[d]}</option>)}</select></label>:<label>Data<input type="date" name="date" required defaultValue={record.date}/></label>}
 <label>Programa<select aria-label="Programa" name="program_id" defaultValue={record.program_id??''}><option value="">Selecione (dispensável no cancelamento)</option>{programs.map(p=><option key={p.id} value={p.id}>{p.name}{!p.active?' (inativo)':''}</option>)}</select></label>
 <label>Início<input name="start_time" placeholder="08:00" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" required defaultValue={record.start_time?.slice(0,5)}/></label><label>Término<input name="end_time" placeholder="12:00 ou 24:00" required defaultValue={record.end_time?.slice(0,5)}/></label>
 {kind==='schedule_exceptions'&&<>{input('title','Título especial (opcional)')}{input('note','Observação (opcional)',600)}<label className="check"><input name="cancelled" type="checkbox" defaultChecked={record.cancelled}/>Cancelar esta faixa</label></>}
 </>}
 <label className="check"><input name="active" type="checkbox" defaultChecked={record.active??true}/>Ativo</label>
 <p role="status">{error}</p><div className="phase-buttons"><button className="button" disabled={busy}>Salvar</button>{record.id&&<button className="button secondary" name="intent" value="delete" disabled={busy} onClick={e=>{if(!confirm('Excluir este registro?'))e.preventDefault();}}>Excluir</button>}</div></form>;
}
export function ScheduleAdmin({slots,exceptions,programs}:{slots:Slot[];exceptions:Slot[];programs:Program[]}){
 const [day,setDay]=useState(1);
 return <><nav className="day-tabs" aria-label="Dias da semana">{[1,2,3,4,5,6,0].map(d=><button key={d} aria-pressed={day===d} onClick={()=>setDay(d)}>{days[d]}</button>)}</nav><h2>{days[day]}</h2><p>Faixas recorrentes. Para atravessar meia-noite, divida em duas faixas; término aceita 24:00.</p>
 {slots.filter(s=>s.weekday===day).map(s=><details key={s.id}><summary>{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)} · {s.program?.name} {!s.active?'(inativo)':''}</summary><ProgrammingForm kind="schedule_slots" record={s} programs={programs}/></details>)}
 <details key={day}><summary>Adicionar horário</summary><ProgrammingForm kind="schedule_slots" record={{weekday:day}} programs={programs}/></details>
 <h2>Programação especial</h2><p>Substitui ou cancela somente o intervalo indicado na data. O restante da grade permanece.</p>
 {exceptions.map(s=><details key={s.id}><summary>{s.date} · {s.start_time.slice(0,5)} – {s.end_time.slice(0,5)} · {s.cancelled?'Cancelamento':s.title||s.program?.name} {!s.active?'(inativo)':''}</summary><ProgrammingForm kind="schedule_exceptions" record={s} programs={programs}/></details>)}
 <details><summary>Adicionar programação especial</summary><ProgrammingForm kind="schedule_exceptions" programs={programs}/></details></>;
}
