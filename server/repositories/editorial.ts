import 'server-only';
import { cache } from 'react';
import { getPool } from '@/lib/db/pool';
import { requireEditorial } from '@/lib/auth/editorial';
import type { News, Taxonomy, TaxonomyKind } from '@/lib/editorial/types';
import { statuses, uuid } from '@/lib/editorial/validation';
import {retentionPolicy} from '@/server/services/news-lifecycle';

const projection = `n.*, COALESCE(n.id::text=(SELECT value FROM settings WHERE key='HOME_LEAD_NEWS_ID'),false) AS home_lead, COALESCE(n.id::text=(SELECT value FROM settings WHERE key='URGENT_NEWS_ID'),false) AS urgent, a.name AS author_name, a.bio AS author_bio, a.photo_url AS author_photo,
  COALESCE((SELECT json_agg(json_build_object('id',c.id,'name',c.name,'slug',c.slug,'active',c.active) ORDER BY c.name)
    FROM news_categories nc JOIN categories c ON c.id=nc.category_id WHERE nc.news_id=n.id), '[]') AS categories`;
export const publicNewsTable=cache(async()=> (await retentionPolicy()).ready?'public_news_managed':'public_news');
export type NewsFilters = { q?: string; status?: string; category?: string; author?: string; source?:string; sourceId?:string; page?: string; featured?: boolean; exclude?: string; limit?: number };
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
  if(admin){const state=await retentionPolicy();if(state.ready)clauses.push(`NOT EXISTS (SELECT 1 FROM news_lifecycle l WHERE l.news_id=n.id AND (l.trashed_at IS NOT NULL ${state.policy.prospective_from?"OR (l.retention_managed AND NOT l.permanent AND NOT l.editorial_protected AND NOT n.featured AND n.id::text<>COALESCE((SELECT value FROM settings WHERE key='HOME_LEAD_NEWS_ID'),'') AND l.expires_at<=now())":""}))`);}
  const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };
  const q = filters.q?.trim().slice(0, 200);
  if (q) {
    const ref = bind(q);
    clauses.push(`(to_tsvector('spanish',n.title || ' ' || n.subtitle || ' ' || n.excerpt) @@ websearch_to_tsquery('spanish',${ref})
      OR strpos(lower(n.title || ' ' || n.subtitle || ' ' || n.excerpt), lower(${ref})) > 0)`);
  }
  if (admin && filters.status && statuses.includes(filters.status as typeof statuses[number])) clauses.push(`n.status=${bind(filters.status)}`);
  if (filters.category) clauses.push(`EXISTS (SELECT 1 FROM news_categories nc JOIN categories c ON c.id=nc.category_id WHERE nc.news_id=n.id AND c.slug=${bind(filters.category)} ${admin ? '' : 'AND c.active'})`);
  if (filters.author) clauses.push(`a.slug=${bind(filters.author)}`);
  if (filters.sourceId) clauses.push(`(n.source_name=${bind(filters.source||'')} OR EXISTS (SELECT 1 FROM source_news_items si WHERE si.news_id=n.id AND si.resource_id=${bind(filters.sourceId)}::uuid))`);
  else if (filters.source) clauses.push(`n.source_name=${bind(filters.source)}`);
  if (filters.featured) clauses.push('n.featured');
  if (filters.exclude) clauses.push(`n.id<>${bind(filters.exclude)}::uuid`);
  const table = admin ? 'news' : await publicNewsTable();
  const from = `FROM ${table} n JOIN authors a ON a.id=n.author_id ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}`;
  const count = Number((await getPool().query(`SELECT count(*) ${from}`, params)).rows[0].count);
  const limit = Math.max(1, Math.min(50, filters.limit || 12));
  const pages = Math.max(1, Math.ceil(count / limit));
  const page = Math.min(pages, Math.max(1, Math.min(100000, Number.parseInt(filters.page || '1', 10) || 1)));
  const offset = (page - 1) * limit;
  const order = admin ? 'COALESCE(n.scheduled_at,n.published_at,n.created_at) DESC,n.id' : 'n.visible_at DESC,n.id';
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
  return (await getPool().query<News>(`SELECT ${projection} FROM ${await publicNewsTable()} n JOIN authors a ON a.id=n.author_id WHERE n.slug=$1`, [slug])).rows[0] ?? null;
});
export async function sitemapNews() {
  return (await getPool().query<{ slug: string; updated_at: Date }>(`SELECT slug,updated_at FROM ${await publicNewsTable()} ORDER BY visible_at DESC,id LIMIT 49000`)).rows;
}
export async function homeNews(pageValue='1') {
  const table=await publicNewsTable();
  const [result,total]=await Promise.all([
   getPool().query<News>(`SELECT ${projection} FROM ${table} n JOIN authors a ON a.id=n.author_id ORDER BY home_lead DESC,urgent DESC,n.featured DESC,n.visible_at DESC,n.id LIMIT 7`),
   getPool().query(`SELECT count(*) FROM ${table}`)
  ]);
  const pageSize=32,count=Math.max(0,Number(total.rows[0].count)-result.rows.length),pages=Math.max(1,Math.ceil(count/pageSize));
  const page=Math.min(pages,Math.max(1,Number.parseInt(pageValue,10)||1));
  const recent=await getPool().query<News>(`SELECT ${projection} FROM ${table} n JOIN authors a ON a.id=n.author_id WHERE NOT(n.id=ANY($1::uuid[])) ORDER BY n.visible_at DESC,n.id LIMIT $2 OFFSET $3`,[result.rows.map(n=>n.id),pageSize,(page-1)*pageSize]);
  return {lead:result.rows,recent:recent.rows,page,pages,renderedAt:Date.now()};
}
export async function sourceNewsHighlights(urls:string[],exclude:string[]=[]){
 try{
  const result=await getPool().query<News & {resource_url:string}>(`SELECT DISTINCT ON (r.id) ${projection},r.url AS resource_url
   FROM portal_resources r JOIN source_news_items si ON si.resource_id=r.id JOIN ${await publicNewsTable()} n ON n.id=si.news_id JOIN authors a ON a.id=n.author_id
   WHERE r.active AND r.kind='source' AND r.url=ANY($1::text[]) AND n.cover_image<>'' AND NOT(n.id=ANY($2::uuid[]))
   ORDER BY r.id,n.published_at DESC,n.created_at DESC,n.id`,[urls,exclude]);
  return [...new Map(result.rows.sort((a,b)=>urls.indexOf(a.resource_url)-urls.indexOf(b.resource_url)).map(n=>[n.id,n])).values()];
 }catch(error){if((error as {code?:string}).code==='42P01')return [];throw error;}
}
