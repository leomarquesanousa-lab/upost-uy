import Link from 'next/link';
import { notFound,redirect } from 'next/navigation';
import { requireOperations } from '@/lib/auth/operations';
import { managedUser } from '@/server/services/admin-users';
import { UserForm } from '@/components/admin/user-form';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{acao?:string}>}){const actor=await requireOperations(),{id}=await params;if(id!=='novo'&&!/^[a-f0-9-]{36}$/.test(id))notFound();const user=id==='novo'?undefined:await managedUser(id);if(id!=='novo'&&!user)notFound();if(user?.role==='OWNER'&&actor.role!=='OWNER')redirect('/admin/usuarios');return <><Link href="/admin/usuarios">← Usuários</Link><h1>{user?'Editar usuário':'Novo usuário'}</h1><UserForm record={user||undefined} role={actor.role} resetPassword={(await searchParams).acao==='senha'}/></>;}
