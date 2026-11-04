'use server';
import { revalidatePath } from 'next/cache';
import { requireMutation } from '@/lib/auth/editorial';
import { renderBody } from '@/lib/editorial/content.mjs';
import { saveNews, saveTaxonomy, deleteTaxonomy, editorialMessage } from '@/server/services/editorial';
import type { TaxonomyKind } from '@/lib/editorial/types';
export type ActionResult = { error?: string; id?: string; ok?: boolean };
export async function taxonomyAction(kind: TaxonomyKind, form: FormData): Promise<ActionResult> {
  try {
    if (!['categories','authors'].includes(kind)) return { error: 'Tipo inválido.' };
    const user = await requireMutation();
    if (form.get('intent') === 'delete') { await deleteTaxonomy(kind,form,user.id); }
    else { const id = await saveTaxonomy(kind,form,user.id); revalidatePath('/', 'layout'); return { ok: true,id }; }
    revalidatePath('/', 'layout'); return { ok: true };
  } catch (error) { return { error: editorialMessage(error) }; }
}
export async function newsAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireMutation();
    const id = await saveNews(form,user.id);
    revalidatePath('/', 'layout'); return { ok: true,id };
  } catch (error) { return { error: editorialMessage(error) }; }
}
export async function previewBody(body: string) {
  try {
    await requireMutation();
    if (typeof body !== 'string' || body.length > 100000) return { error: 'Conteúdo excede 100 mil caracteres.' };
    return { html: renderBody(body) };
  } catch { return { error: 'Não foi possível gerar a prévia. Verifique sua sessão.' }; }
}
