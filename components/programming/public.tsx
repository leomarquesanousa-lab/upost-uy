/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicProgramming,type Program,type Slot } from '@/server/services/programming';
import { days } from '@/lib/programming/engine.mjs';
export function ProgramNav(){return <nav className="day-tabs" aria-label="Rádio"><Link href="/programacao">Programação</Link><Link href="/programas">Programas</Link><Link href="/apresentadores">Apresentadores</Link></nav>;}
export function ProgramNames({program}:{program?:Program}){return <span>{program?.presenters.map(p=>p.name).join(' · ')}</span>;}
export function SlotCard({slot,current=false}:{slot:Slot;current?:boolean}){return <article className={`slot-card ${current?'on-now':''}`}><time>{slot.start_time.slice(0,5)} – {slot.end_time.slice(0,5)}</time><div>{current&&<strong className="eyebrow">NO AR AGORA</strong>}<h3><Link href={`/programas/${slot.program?.slug}`}>{slot.title||slot.program?.name}</Link></h3><ProgramNames program={slot.program}/>{slot.special&&<small> · Programação especial</small>}</div></article>;}
export async function PublicCatalog({kind,slug}:{kind:'programs'|'presenters';slug?:string}){
 const d=await publicProgramming();const path=kind==='programs'?'programas':'apresentadores';const rows=d[kind];
 if(!slug)return <><ProgramNav/><h1>{kind==='programs'?'Programas':'Apresentadores'}</h1><div className="phase-cards">{rows.map(r=><article key={r.id}>{('cover_image'in r?r.cover_image:r.photo_url)&&<img className="program-cover" src={'cover_image'in r?r.cover_image:r.photo_url} alt={r.name}/>}<h2><Link href={`/${path}/${r.slug}`}>{r.name}</Link></h2>{'short_description' in r?<p>{r.short_description}</p>:<p>{r.bio.slice(0,200)}</p>}</article>)}</div>{!rows.length&&<p>Os cadastros serão disponibilizados em breve.</p>}</>;
 const record=rows.find(r=>r.slug===slug);if(!record)notFound();const image='cover_image'in record?record.cover_image:record.photo_url;
 return <><ProgramNav/><h1>{record.name}</h1>{image&&<img className="program-cover" src={image} alt={record.name}/>}
 {'description'in record?<><p className="preserve-lines">{record.description||record.short_description}</p><h2>Apresentadores</h2>{record.presenters.map(p=><p key={p.id}><Link href={`/apresentadores/${p.slug}`}>{p.name}</Link></p>)}<h2>Horários regulares</h2>{d.slots.filter(s=>s.active&&s.program_id===record.id).map(s=><p key={s.id}>{days[s.weekday]} · {s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}</p>)}</>:<><p className="preserve-lines">{record.bio}</p><div className="day-tabs">{[['Instagram',record.social_instagram],['Facebook',record.social_facebook],['X',record.social_x]].filter(([,url])=>url).map(([label,url])=><a key={label} href={url} target="_blank" rel="noopener noreferrer">{label}</a>)}</div><h2>Programas</h2>{d.programs.filter(p=>p.presenters.some(a=>a.id===record.id)).map(p=><p key={p.id}><Link href={`/programas/${p.slug}`}>{p.name}</Link></p>)}</>}
 </>;
}
