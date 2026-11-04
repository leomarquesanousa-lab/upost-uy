import 'server-only';
import { headers } from 'next/headers';
import { requireUser } from './session';
import { EditorialError } from '@/lib/editorial/validation';
export async function requireEditorial() {
  const user = await requireUser();
  if (!['OWNER', 'ADMIN', 'EDITOR'].includes(user.role)) throw new EditorialError('Você não tem permissão para esta ação.');
  return user;
}
export async function requireMutation() {
  const user = await requireEditorial();
  const h = await headers();
  let allowed = false;
  try { allowed = new URL(h.get('origin') || '').host === (h.get('x-forwarded-host') || h.get('host')); } catch {}
  if (!allowed) throw new EditorialError('Origem da solicitação inválida.');
  return user;
}
