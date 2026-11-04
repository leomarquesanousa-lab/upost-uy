import { requireUser } from '@/lib/auth/session';
import { managedUser } from '@/server/services/admin-users';
import { UserForm } from '@/components/admin/user-form';
export default async function Page(){const actor=await requireUser();const user=await managedUser(actor.id);return <><h1>Minha Conta</h1><UserForm record={user!} role={actor.role} self/></>;}
