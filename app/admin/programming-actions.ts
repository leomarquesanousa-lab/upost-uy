'use server';
import { revalidatePath } from 'next/cache';
import { requireMutation } from '@/lib/auth/editorial';
import { saveProgramming,type Kind } from '@/server/services/programming';
import { EditorialError } from '@/lib/editorial/validation';
export async function programmingAction(kind:Kind,form:FormData){
 try{const user=await requireMutation();const id=await saveProgramming(kind,form,user.id);revalidatePath('/','layout');return {ok:true,id};}
 catch(e){return {error:e instanceof EditorialError?e.message:'Não foi possível salvar. Verifique sua sessão e tente novamente.'};}
}
