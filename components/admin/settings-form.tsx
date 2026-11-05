'use client';
import {useState} from 'react';
import {settingsAction} from '@/app/admin/operations-actions';
export function SettingsForm({values}:{values:{SITE_NAME:string;RADIO_STREAM_URL:string;LIVE_CAMERA_EMBED_URL:string;PORTAL_TIMEZONE:string;CHAT_ENABLED:boolean;WHATSAPP_NUMBER:string}}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <form className="phase-form" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);try{const result=await settingsAction(form);setMessage(result.error||'Configuración guardada.');}finally{setBusy(false);}}}>
 <label>Nombre del portal<input name="SITE_NAME" defaultValue={values.SITE_NAME} required maxLength={120}/></label>
 <label>Zona horaria<input name="PORTAL_TIMEZONE" defaultValue={values.PORTAL_TIMEZONE} required maxLength={100}/></label>
 <p>Las fechas editoriales se presentan en America/Montevideo. Las radios y fuentes autorizadas se gestionan en Red y fuentes.</p>
 <p role="status">{message}</p><button className="button" disabled={busy}>{busy?'Guardando…':'Guardar configuración'}</button></form>;
}
