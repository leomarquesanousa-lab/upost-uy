import 'server-only';
import { requireUser } from './session';
import { requireMutation } from './editorial';
import { redirect } from 'next/navigation';
import { EditorialError } from '@/lib/editorial/validation';
export async function requireOperations(ownerOnly=false){const user=await requireUser();if(user.role==='EDITOR'||(ownerOnly&&user.role!=='OWNER'))redirect('/admin');return user;}
export async function operationsMutation(ownerOnly=false){const user=await requireMutation();if(user.role==='EDITOR'||(ownerOnly&&user.role!=='OWNER'))throw new EditorialError('Você não tem permissão para esta operação.');return user;}
