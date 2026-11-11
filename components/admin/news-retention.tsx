'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {retentionSettingsAction,retentionDryRunAction} from '@/app/admin/news-lifecycle-actions';
import type {RetentionPolicy} from '@/server/services/news-lifecycle';
export function NewsRetentionForm({policy,ready}:{policy:RetentionPolicy;ready:boolean}) {
 const [message,setMessage]=useState(''),[pending,start]=useTransition(),router=useRouter();
 const fields=[['global_daily_limit','Importaciones totales por día',1,10000],['min_sync_minutes','Intervalo mínimo (minutos)',60,10080],['publication_hours','Publicación: 15 días completos (360 horas)',360,360],['recovery_days','Días de recuperación',1,3650],['active_limit','Máximo de noticias automáticas activas',1,100000]] as const;
 return <section><h2>Límites y conservación</h2>{!ready&&<p role="status">La política de 15 días requiere activar las migraciones 011 y 012. No se aplicarán automáticamente. Las noticias existentes no vencerán retroactivamente.</p>}
 <form className="editorial-form" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);start(async()=>{const r=await retentionSettingsAction(form);setMessage(r.message);if(r.ok)router.refresh();});}}>
 <fieldset disabled={!ready||pending}>{fields.map(([key,label,min,max])=><label key={key}>{label}<input name={key} type="number" min={min} max={max} required defaultValue={policy[key]}/></label>)}
 <label className="check-label"><input name="cleanup_enabled" type="checkbox" defaultChecked={policy.cleanup_enabled}/>Habilitar limpieza definitiva de noticias vencidas incluidas en la política</label>
 <p>Las nuevas publicaciones manuales y automáticas se conservan durante 15 días completos desde su fecha de publicación. Se preservan las anteriores, fijadas y protegidas. La limpieza definitiva empieza desactivada y respeta el período de recuperación. Ejecutá primero la simulación.</p>
 <button className="button">Guardar límites</button></fieldset></form>
 <button className="button secondary" type="button" disabled={!ready||pending} onClick={()=>start(async()=>{setMessage((await retentionDryRunAction()).message);})}>Simular limpieza</button>{message&&<p role="status">{message}</p>}<p><Link href="/admin/noticias/papelera">Consultar vencidas y Papelera →</Link></p></section>;
}
