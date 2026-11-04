'use server';
import { revalidatePath } from 'next/cache';
import { requireMutation } from '@/lib/auth/editorial';
import { operationsMutation } from '@/lib/auth/operations';
import { saveUser } from '@/server/services/admin-users';
import { EditorialError } from '@/lib/editorial/validation';
import { saveCampaign,saveAdSlot } from '@/server/services/ads';
import { saveSettings } from '@/server/services/operational-settings';
import { saveIntegrationSettings } from '@/server/services/integrations';
export type OperationResult={error?:string;ok?:boolean;id?:string;reauth?:boolean};
export async function userAction(form:FormData,self=false):Promise<OperationResult>{
 try{const user=self?await requireMutation():await operationsMutation();const result=await saveUser(form,user.id,self);revalidatePath('/admin','layout');return {ok:true,...result};}
 catch(e){return {error:e instanceof EditorialError?e.message:'Não foi possível salvar. Verifique sua sessão e tente novamente.'};}
}
export async function adAction(form:FormData,slot=false):Promise<OperationResult>{try{const user=await operationsMutation();const id=slot?(await saveAdSlot(form,user.id),undefined):await saveCampaign(form,user.id);revalidatePath('/','layout');return {ok:true,id};}catch(e){return {error:e instanceof EditorialError?e.message:'Não foi possível salvar a publicidade.'};}}
export async function settingsAction(form:FormData):Promise<OperationResult>{try{const user=await operationsMutation(true);await saveSettings(form,user.id);revalidatePath('/','layout');return {ok:true};}catch(e){return {error:e instanceof EditorialError?e.message:'Não foi possível salvar as configurações.'};}}

export async function integrationsAction(form:FormData):Promise<OperationResult>{try{const user=await operationsMutation(true);await saveIntegrationSettings(form,user.id);revalidatePath('/','layout');revalidatePath('/admin/integracoes');return {ok:true};}catch(e){return {error:e instanceof EditorialError?e.message:'Não foi possível salvar as integrações.'};}}
