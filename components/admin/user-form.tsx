'use client';
import { roleLabels } from '@/lib/admin/roles';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { userAction } from '@/app/admin/operations-actions';
import type { ManagedUser } from '@/server/services/admin-users';
export function UserForm({record,role,self=false,resetPassword=false}:{record?:ManagedUser;role:string;self?:boolean;resetPassword?:boolean}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);const router=useRouter();
 async function submit(form:FormData){setBusy(true);setMessage('');const r=await userAction(form,self);setBusy(false);if(r.error)setMessage(r.error);else if(r.reauth)router.push('/admin/login');else{setMessage('Cambios guardados.');if(!self)router.push('/admin/usuarios');router.refresh();}}
 const identity=record&&<input type="hidden" name="id" value={record.id}/>;
 const passwords=<><label>{record?'Nueva contraseña':'Contraseña inicial'}<input name="password" type="password" minLength={12} maxLength={256} required autoComplete="new-password"/></label><label>Confirmar contraseña<input name="confirmation" type="password" minLength={12} maxLength={256} required autoComplete="new-password"/></label><small>De 12 a 256 caracteres. Las contraseñas nunca se muestran después de guardar.</small></>;
 return <><p role="status">{message}</p><form onSubmit={e=>{e.preventDefault();void submit(new FormData(e.currentTarget));}} className="phase-form">{identity}<label>Nombre<input name="name" defaultValue={record?.name} maxLength={120} required/></label>
 {self?<><p>E-mail: {record?.email}</p><p>Rol: {roleLabels[record?.role||'']}</p></>:<><label>E-mail<input name="email" type="email" defaultValue={record?.email} maxLength={254} required/></label><label>Rol<select name="role" aria-label="Rol" defaultValue={record?.role||'EDITOR'}>{(role==='OWNER'?['OWNER','ADMIN','EDITOR']:['ADMIN','EDITOR']).map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}</select></label><label className="check"><input type="checkbox" name="active" defaultChecked={record?.active??true}/>Activo</label></>}
 {!record&&passwords}<button className="button" disabled={busy}>Guardar</button></form>
 {record&&<details open={resetPassword||undefined}><summary>{self?'Cambiar mi contraseña':'Restablecer contraseña'}</summary><form onSubmit={e=>{e.preventDefault();void submit(new FormData(e.currentTarget));}} className="phase-form">{identity}<input type="hidden" name="intent" value={self?'password':'reset'}/>{self&&<label>Contraseña actual<input name="current_password" type="password" required maxLength={256} autoComplete="current-password"/></label>}{passwords}<p>Las sesiones existentes se cerrarán.</p><button className="button" disabled={busy}>{self?'Cambiar contraseña':'Restablecer contraseña'}</button></form></details>}
 {record&&!self&&<form onSubmit={e=>{e.preventDefault();void submit(new FormData(e.currentTarget));}} className="phase-form">{identity}<input type="hidden" name="intent" value="delete"/><button className="button secondary" disabled={busy} onClick={e=>{if(!confirm('¿Desactivar este usuario y cerrar sus sesiones?'))e.preventDefault();}}>Desactivar usuario</button></form>}</>;
}
