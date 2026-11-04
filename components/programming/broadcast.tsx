'use client';
import Link from 'next/link';
import { HomeRadio,useRadioProgramming } from '@/components/radio/radio-player';
import type { Slot } from '@/server/services/programming';
export type BroadcastState={current:Slot|null;next:Slot[]};
export function Broadcast({siteName,initial}:{siteName:string;initial:BroadcastState}){
 const state=useRadioProgramming()||initial;
 const presenters=state.current?.program?.presenters.map(p=>p.name).join(' · ');
 return <div className="portal-row broadcast-row"><HomeRadio siteName={siteName} nowPlaying={state.current?{name:state.current.title||state.current.program?.name||'',presenters:presenters||''}:undefined}/><section className="programming-panel" id="programacao-radio"><div className="panel-heading"><h2>Programação da rádio</h2></div><p className="eyebrow">AGORA</p>{state.current?<><h3>{state.current.title||state.current.program?.name}</h3><p>{state.current.start_time} – {state.current.end_time}</p><p>{presenters}</p></>:<p>Ouça a rádio ao vivo. Nenhum programa agendado agora.</p>}<p className="eyebrow">DEPOIS</p><ol className="program-list">{state.next.map(s=><li key={`${s.date}-${s.id}-${s.start_time}`}><time>{s.date.split('-').reverse().slice(0,2).join('/')} · {s.start_time}</time><Link href={`/programas/${s.program?.slug}`}>{s.title||s.program?.name}</Link></li>)}</ol>{!state.next.length&&<p>Grade em preparação.</p>}<Link href="/programacao">Ver programação completa ↗</Link></section></div>;
}
