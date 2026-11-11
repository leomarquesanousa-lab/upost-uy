'use server';
import { revalidatePath } from 'next/cache';
import { requireMutation } from '@/lib/auth/editorial';
import { operationsMutation } from '@/lib/auth/operations';
import { getPool } from '@/lib/db/pool';
import { uuid,text } from '@/lib/editorial/validation';
import { retentionInput } from '@/lib/editorial/retention.mjs';
import { manageNewsLifecycle,retentionPolicy,runNewsRetention } from '@/server/services/news-lifecycle';
export async function lifecycleAction(form:FormData) {
 try{const actor=await requireMutation();await manageNewsLifecycle(uuid(text(form,'id',36,true)),text(form,'operation',20,true),actor);revalidatePath('/','layout');return {ok:true,message:'Cambios guardados.'};}
 catch(error){return {ok:false,message:error instanceof Error&&/permiso|Noticia|noticia|migración|protegi|Operación|Restaurá|Papelera/.test(error.message)?error.message:'No se pudo completar la operación.'};}
}
export async function retentionSettingsAction(form:FormData) {
 try{const user=await operationsMutation();const input=retentionInput(form);const db=await getPool().connect();try{
  await db.query('BEGIN');const state=await retentionPolicy(db);if(!state.ready||!state.policy.prospective_from)throw Error('Activá las migraciones 011 y 012.');
  await db.query(`UPDATE news_retention_policy SET global_daily_limit=$1,min_sync_minutes=$2,publication_hours=$3,recovery_days=$4,active_limit=$5,cleanup_enabled=$6,updated_at=now() WHERE id=true`,[input.global_daily_limit,input.min_sync_minutes,input.publication_hours,input.recovery_days,input.active_limit,input.cleanup_enabled]);
  await db.query("INSERT INTO audit_log(user_id,action,entity,metadata) VALUES($1,'news.retention_policy','settings',$2)",[user.id,JSON.stringify(input)]);await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 revalidatePath('/admin/fuentes-automaticas');return {ok:true,message:'Límites guardados. Retención de 15 días para nuevas publicaciones manuales y automáticas.'};
 }catch{return {ok:false,message:'No se pudo guardar. Revisá los límites, tus permisos y la activación de la migración 011.'};}
}
export async function retentionDryRunAction() {
 try{await operationsMutation();const result=await runNewsRetention();return {ok:result.ready,message:result.busy?'Ya hay una limpieza en curso.':`Simulación: ${result.expired} vencidas, ${result.removed} noticias y ${result.images} imágenes elegibles. No se modificaron datos. ${result.message}`};}
 catch{return {ok:false,message:'No se pudo completar la simulación.'};}
}
