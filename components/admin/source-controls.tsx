'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {configureInitialSources,syncResource} from '@/app/admin/resource-actions';
export function SourceControls({id,disabled=false,preset}:{id?:string;disabled?:boolean;preset?:string}){
 const [message,setMessage]=useState(''),[pending,start]=useTransition(),router=useRouter();
 return <div><button type="button" className="button secondary" disabled={disabled||pending} onClick={()=>start(async()=>{try{const f=new FormData();if(id)f.set('id',id);if(preset)f.set('initial_source',preset);const result=id?await syncResource(f):await configureInitialSources(f);setMessage(result.message);router.refresh();}catch{setMessage('No se pudo completar la solicitud. Intentá nuevamente.');}})}>{pending?'Consultando…':id?'Sincronizar ahora':preset?'Registrar fuente':'Registrar las tres fuentes'}</button>{message&&<p role="status">{message}</p>}</div>;
}
