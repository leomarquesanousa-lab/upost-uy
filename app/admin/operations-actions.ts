'use server';
import { revalidatePath } from 'next/cache';
import { requireMutation } from '@/lib/auth/editorial';
import { operationsMutation } from '@/lib/auth/operations';
import { saveUser } from '@/server/services/admin-users';
import { EditorialError } from '@/lib/editorial/validation';
import { saveCampaign,saveAdSlot,createTopAdSlot } from '@/server/services/ads';
import { saveSimpleBanner,manageSimpleBanner } from '@/server/services/simple-banners';
export async function simpleBannerAction(form:FormData):Promise<OperationResult>{try{const user=await operationsMutation();const id=await saveSimpleBanner(form,user.id);revalidatePath('/admin/publicidade');revalidatePath('/');return {ok:true,id};}catch(e){return {error:e instanceof EditorialError?e.message:'No se pudo guardar el banner.'};}}
export async function manageBannerAction(form:FormData):Promise<OperationResult>{try{const user=await operationsMutation();await manageSimpleBanner(form,user.id);revalidatePath('/admin/publicidade');revalidatePath('/');return {ok:true};}catch(e){return {error:e instanceof EditorialError?e.message:'No se pudo actualizar el banner.'};}}
import { saveSettings } from '@/server/services/operational-settings';
import { saveIntegrationSettings } from '@/server/services/integrations';
export type OperationResult={error?:string;ok?:boolean;id?:string;reauth?:boolean};
export async function userAction(form:FormData,self=false):Promise<OperationResult>{
 try{const user=self?await requireMutation():await operationsMutation();const result=await saveUser(form,user.id,self);revalidatePath('/admin','layout');return {ok:true,...result};}
 catch(e){return {error:e instanceof EditorialError?e.message:'Não foi possível salvar. Verifique sua sessão e tente novamente.'};}
}
export async function adAction(form:FormData,slot=false):Promise<OperationResult>{try{const user=await operationsMutation();const id=slot?(await saveAdSlot(form,user.id),undefined):await saveCampaign(form,user.id);revalidatePath('/','layout');return {ok:true,id};}catch(e){return {error:e instanceof EditorialError?e.message:'Não foi possível salvar a publicidade.'};}}
export async function createTopAdSlotAction(form:FormData):Promise<OperationResult>{try{const user=await operationsMutation();await createTopAdSlot(form,user.id);revalidatePath('/admin/publicidade');return {ok:true};}catch(e){return {error:e instanceof EditorialError?e.message:'No se pudo configurar la ubicación.'};}}
export async function settingsAction(form:FormData):Promise<OperationResult>{try{const user=await operationsMutation(true);await saveSettings(form,user.id);revalidatePath('/','layout');return {ok:true};}catch(e){return {error:e instanceof EditorialError?e.message:'Não foi possível salvar as configurações.'};}}

export async function integrationsAction(form:FormData):Promise<OperationResult>{try{const user=await operationsMutation(true);await saveIntegrationSettings(form,user.id);revalidatePath('/','layout');revalidatePath('/admin/integracoes');return {ok:true};}catch(e){return {error:e instanceof EditorialError?e.message:'Não foi possível salvar as integrações.'};}}
