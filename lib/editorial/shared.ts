export const statuses = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;
export type NewsStatus = typeof statuses[number];
export const statusLabels: Record<NewsStatus, string> = { DRAFT: 'Rascunho', SCHEDULED: 'Agendada', PUBLISHED: 'Publicada', ARCHIVED: 'Arquivada' };
export function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180).replace(/-$/, '');
}
