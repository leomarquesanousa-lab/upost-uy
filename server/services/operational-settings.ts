import 'server-only';
import {getPool} from '@/lib/db/pool';
import {getSettings} from './settings';
import {portalTimezone} from './ads';
import {text,EditorialError} from '@/lib/editorial/validation';
export async function operationalSettings(){const [settings,timezone,chat]=await Promise.all([getSettings(),portalTimezone(),getPool().query("SELECT value FROM settings WHERE key='CHAT_ENABLED'")]);return {SITE_NAME:settings.siteName,WHATSAPP_NUMBER:settings.whatsappNumber,RADIO_STREAM_URL:settings.radioStreamUrl,LIVE_CAMERA_EMBED_URL:settings.liveCameraEmbedUrl,PORTAL_TIMEZONE:timezone,CHAT_ENABLED:chat.rows[0]?.value==='true'};}
export async function saveSettings(form:FormData,userId:string){
 const values:Record<string,string>={SITE_NAME:text(form,'SITE_NAME',120,true),PORTAL_TIMEZONE:text(form,'PORTAL_TIMEZONE',100,true)};
 if(values.PORTAL_TIMEZONE!=='America/Montevideo')throw new EditorialError('El portal utiliza la zona America/Montevideo.');
 const client=await getPool().connect();
 try{await client.query('BEGIN');const owner=await client.query("SELECT id FROM users WHERE id=$1 AND role='OWNER' AND active FOR SHARE",[userId]);
  if(!owner.rowCount)throw new EditorialError('Solo OWNER puede modificar la configuración.');
  for(const [key,value] of Object.entries(values))await client.query('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()',[key,value]);
  await client.query("INSERT INTO audit_log(user_id,action,entity,metadata) VALUES($1,'settings.updated','settings',$2)",[userId,JSON.stringify({keys:Object.keys(values)})]);await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
