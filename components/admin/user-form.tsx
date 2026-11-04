'use client';
import { roleLabels } from '@/lib/admin/roles';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { userAction } from '@/app/admin/operations-actions';
import type { ManagedUser } from '@/server/services/admin-users';
export function UserForm({record,role,self=false,resetPassword=false}:{record?:ManagedUser;role:string;self?:boolean;resetPassword?:boolean}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);const router=useRouter();
 async function submit(form:FormData){setBusy(true);setMessage('');const r=await userAction(form,self);setBusy(false);if(r.error)setMessage(r.error);else if(r.reauth)router.push('/admin/login');else{setMessage('Alterações salvas.');if(!self)router.push('/admin/usuarios');router.refresh();}}
 const identity=record&&<input type="hidden" name="id" value={record.id}/>;
 const passwords=<><label>{record?'Nova senha':'Senha inicial'}<input name="password" type="password" minLength={12} maxLength={256} required autoComplete="new-password"/></label><label>Confirmar senha<input name="confirmation" type="password" minLength={12} maxLength={256} required autoComplete="new-password"/></label><small>De 12 a 256 caracteres. Senhas nunca são exibidas após salvar.</small></>;
 return <><p role="status">{message}</p><form onSubmit={e=>{e.preventDefault();void submit(new FormData(e.currentTarget));}} className="phase-form">{identity}<label>Nome<input name="name" defaultValue={record?.name} maxLength={120} required/></label>
 {self?<><p>E-mail: {record?.email}</p><p>Papel: {roleLabels[record?.role||'']}</p></>:<><label>E-mail<input name="email" type="email" defaultValue={record?.email} maxLength={254} required/></label><label>Papel<select name="role" aria-label="Papel" defaultValue={record?.role||'EDITOR'}>{(role==='OWNER'?['OWNER','ADMIN','EDITOR']:['ADMIN','EDITOR']).map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}</select></label><label className="check"><input type="checkbox" name="active" defaultChecked={record?.active??true}/>Ativo</label></>}
 {!record&&passwords}<button className="button" disabled={busy}>Salvar</button></form>
 {record&&<details open={resetPassword||undefined}><summary>{self?'Trocar minha senha':'Redefinir senha'}</summary><form onSubmit={e=>{e.preventDefault();void submit(new FormData(e.currentTarget));}} className="phase-form">{identity}<input type="hidden" name="intent" value={self?'password':'reset'}/>{self&&<label>Senha atual<input name="current_password" type="password" required maxLength={256} autoComplete="current-password"/></label>}{passwords}<p>As sessões existentes serão encerradas.</p><button className="button" disabled={busy}>{self?'Trocar senha':'Redefinir senha'}</button></form></details>}
 {record&&!self&&<form onSubmit={e=>{e.preventDefault();void submit(new FormData(e.currentTarget));}} className="phase-form">{identity}<input type="hidden" name="intent" value="delete"/><button className="button secondary" disabled={busy} onClick={e=>{if(!confirm('Excluir logicamente este usuário e encerrar suas sessões?'))e.preventDefault();}}>Excluir usuário</button></form>}</>;
}
