import 'server-only';
import { cache } from 'react';
import { getPool } from '@/lib/db/pool';
import { requireEditorial } from '@/lib/auth/editorial';
import type { News, Taxonomy, TaxonomyKind } from '@/lib/editorial/types';
import { statuses, uuid } from '@/lib/editorial/validation';

const projection = `n.*, a.name AS author_name, a.bio AS author_bio, a.photo_url AS author_photo,
  COALESCE((SELECT json_agg(json_build_object('id',c.id,'name',c.name,'slug',c.slug,'active',c.active) ORDER BY c.name)
    FROM news_categories nc JOIN categories c ON c.id=nc.category_id WHERE nc.news_id=n.id), '[]') AS categories`;
export type NewsFilters = { q?: string; status?: string; category?: string; author?: string; page?: string; featured?: boolean; exclude?: string; limit?: number };
export function queryValue(value: string | string[] | undefined) { return typeof value === 'string' ? value : ''; }
export async function taxonomyList(kind: TaxonomyKind, publicOnly = false): Promise<Taxonomy[]> {
  if (!publicOnly) await requireEditorial();
  const table = kind === 'categories' ? 'categories' : 'authors';
  return (await getPool().query<Taxonomy>(`SELECT * FROM ${table} ${publicOnly ? 'WHERE active' : ''} ORDER BY name,id`)).rows;
}
export async function taxonomyById(kind: TaxonomyKind, id: string) {
  await requireEditorial();
  uuid(id);
  const table = kind === 'categories' ? 'categories' : 'authors';
  return (await getPool().query<Taxonomy>(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0] ?? null;
}
export async function listNews(filters: NewsFilters = {}, admin = false) {
  if (admin) await requireEditorial();
  const params: unknown[] = [];
  const clauses: string[] = [];
  const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };
  const q = filters.q?.trim().slice(0, 200);
  if (q) {
    const ref = bind(q);
    clauses.push(`(to_tsvector('portuguese',n.title || ' ' || n.subtitle || ' ' || n.excerpt) @@ websearch_to_tsquery('portuguese',${ref})
      OR strpos(lower(n.title || ' ' || n.subtitle || ' ' || n.excerpt), lower(${ref})) > 0)`);
  }
  if (admin && filters.status && statuses.includes(filters.status as typeof statuses[number])) clauses.push(`n.status=${bind(filters.status)}`);
  if (filters.category) clauses.push(`EXISTS (SELECT 1 FROM news_categories nc JOIN categories c ON c.id=nc.category_id WHERE nc.news_id=n.id AND c.slug=${bind(filters.category)} ${admin ? '' : 'AND c.active'})`);
  if (filters.author) clauses.push(`a.slug=${bind(filters.author)}`);
  if (filters.featured) clauses.push('n.featured');
  if (filters.exclude) clauses.push(`n.id<>${bind(filters.exclude)}::uuid`);
  const table = admin ? 'news' : 'public_news';
  const from = `FROM ${table} n JOIN authors a ON a.id=n.author_id ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}`;
  const count = Number((await getPool().query(`SELECT count(*) ${from}`, params)).rows[0].count);
  const limit = Math.max(1, Math.min(50, filters.limit || 12));
  const pages = Math.max(1, Math.ceil(count / limit));
  const page = Math.min(pages, Math.max(1, Math.min(100000, Number.parseInt(filters.page || '1', 10) || 1)));
  const offset = (page - 1) * limit;
  const order = admin ? 'n.updated_at DESC,n.id' : 'n.visible_at DESC,n.id';
  const result = await getPool().query<News>(`SELECT ${projection} ${from} ORDER BY ${order} LIMIT ${bind(limit)} OFFSET ${bind(offset)}`, params);
  return { items: result.rows, count, pages, page };
}
export async function newsById(id: string) {
  await requireEditorial();
  uuid(id);
  return (await getPool().query<News>(`SELECT ${projection} FROM news n JOIN authors a ON a.id=n.author_id WHERE n.id=$1`, [id])).rows[0] ?? null;
}
export const publicNewsBySlug = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 180) return null;
  return (await getPool().query<News>(`SELECT ${projection} FROM public_news n JOIN authors a ON a.id=n.author_id WHERE n.slug=$1`, [slug])).rows[0] ?? null;
});
export async function sitemapNews() {
  return (await getPool().query<{ slug: string; updated_at: Date }>('SELECT slug,updated_at FROM public_news ORDER BY visible_at DESC,id LIMIT 49000')).rows;
}
export async function homeNews() {
  const result=await getPool().query<News>(`SELECT ${projection} FROM public_news n JOIN authors a ON a.id=n.author_id
    ORDER BY n.visible_at DESC,n.id LIMIT 13`);
  return {lead:result.rows.slice(0,3),recent:result.rows.slice(3),renderedAt:Date.now()};
}
