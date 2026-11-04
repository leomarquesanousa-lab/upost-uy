import type { Metadata } from 'next';
import Link from 'next/link';
import { publicProgramming,type Slot } from '@/server/services/programming';
import { portalClock,addDays,daySchedule } from '@/lib/programming/engine.mjs';
import { pageMetadata } from '@/lib/editorial/seo';
import { ProgramNav,SlotCard } from '@/components/programming/public';

export const dynamic='force-dynamic';
export const metadata: Metadata = pageMetadata({
  title: 'Programação da Rádio | Biosfera Rádio TV Web',
  description: 'Confira os horários, programas e atrações da programação da Biosfera Rádio TV Web.',
  path: '/programacao',
});

export default async function Page({searchParams}:{searchParams:Promise<{dia?:string}>}){
 const d=await publicProgramming(),clock=portalClock(new Date(),d.timezone),selected=(await searchParams).dia;
 const monday=addDays(clock.date,-((clock.weekday+6)%7));const dates=Array.from({length:7},(_,i)=>addDays(monday,i));const date=selected&&dates.includes(selected)?selected:clock.date;
 const slots:Slot[]=daySchedule(date,d.slots,d.exceptions);
 return <><ProgramNav/><h1>Programação da rádio</h1><p>Horários em {d.timezone}. Semana de {monday.split('-').reverse().join('/')}.</p><nav className="day-tabs" aria-label="Dias da semana">{dates.map(v=><Link key={v} aria-current={v===date?'page':undefined} href={`/programacao?dia=${v}`}>{new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:'UTC'}).format(new Date(`${v}T12:00:00Z`))}{v===clock.date?' · Hoje':''}</Link>)}</nav><h2>{date.split('-').reverse().join('/')}</h2>{slots.map(s=><SlotCard key={`${s.id}-${s.start_time}`} slot={s} current={date===clock.date&&s.start_time<=clock.time&&s.end_time>clock.time}/>)}{!slots.length&&<p>Nenhum programa agendado para este dia. Acompanhe a transmissão ao vivo.</p>}</>;
}
