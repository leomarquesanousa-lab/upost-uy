import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireEditorial } from '@/lib/auth/editorial';
import { programmingData } from '@/server/services/programming';
import { ProgrammingForm } from './admin';
export async function CatalogAdmin({kind,id}:{kind:'programs'|'presenters';id?:string}){
 await requireEditorial();const data=await programmingData();const records=data[kind];const path=kind==='programs'?'programas':'apresentadores';const title=kind==='programs'?'Programas':'Apresentadores';
 if(id){const record=id==='novo'?undefined:records.find(r=>r.id===id);if(id!=='novo'&&!record)notFound();return <><Link href={`/admin/${path}`}>← {title}</Link><h1>{id==='novo'?'Novo cadastro':'Editar cadastro'}</h1><ProgrammingForm kind={kind} record={record} presenters={data.presenters} destination={`/admin/${path}`}/></>;}
 return <><h1>{title}</h1><Link className="button" href={`/admin/${path}/novo`}>Novo cadastro</Link><div className="phase-list">{records.length?records.map(r=><Link key={r.id} href={`/admin/${path}/${r.id}`}>{r.name} <small>{r.active?'Ativo':'Inativo'} · Editar</small></Link>):<p>Nenhum cadastro ainda.</p>}</div></>;
}
