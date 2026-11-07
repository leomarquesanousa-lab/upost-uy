'use client';
import { useState,useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { lifecycleAction } from '@/app/admin/news-lifecycle-actions';
export function NewsLifecycleControls({id,trash=false,detail=false,permanent=false,protectedItem=false,admin=false,ready=true,compact=false}:{id:string;trash?:boolean;detail?:boolean;permanent?:boolean;protectedItem?:boolean;admin?:boolean;ready?:boolean;compact?:boolean}) {
 const [message,setMessage]=useState(''),[pending,start]=useTransition(),router=useRouter();
 function act(operation:string){
  if(['trash','purge','unprotect'].includes(operation)&&!confirm(operation==='purge'?'¿Eliminar definitivamente? No se podrá recuperar.':operation==='trash'?'¿Enviar esta noticia a Papelera y retirarla del portal?':'¿Retirar la protección editorial?'))return;
  start(async()=>{const f=new FormData();f.set('id',id);f.set('operation',operation);const r=await lifecycleAction(f);setMessage(r.message);if(r.ok){if(operation==='trash'||operation==='purge')router.push('/admin/noticias/papelera');router.refresh();}});
 }
 return <div className={compact?'news-row-controls':'form-actions'}>
 {trash?<><button className="button secondary" type="button" disabled={pending||!ready} onClick={()=>act('restore')}>Restaurar como borrador</button>{admin&&<button className="button danger" type="button" disabled={pending||!ready||permanent||protectedItem} onClick={()=>act('purge')}>Eliminar definitivamente</button>}</>:<button className="button secondary" type="button" title="Enviar a Papelera" disabled={pending||!ready} onClick={()=>act('trash')}>Eliminar</button>}
 {(detail||trash)&&<><button type="button" className="button secondary" disabled={pending||!ready} onClick={()=>act('permanent')}>{permanent?'Quitar permanencia':'Mantener permanentemente'}</button>{protectedItem&&<span>Protección editorial activa</span>}{protectedItem&&admin&&<button type="button" className="button secondary" disabled={pending||!ready} onClick={()=>act('unprotect')}>Retirar protección editorial</button>}</>}
 {!ready&&<small>Requiere activar la migración 011.</small>}{message&&<p role="status">{message}</p>}</div>;
}
