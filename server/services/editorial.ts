import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db/pool';
import { EditorialError, newsInput, text, slug, uuid, mediaPath } from '@/lib/editorial/validation';
import type { TaxonomyKind } from '@/lib/editorial/types';
import { assertEditorialImage } from './editorial-media';
import { renderedImagePaths } from '@/lib/editorial/content.mjs';

async function transaction<T>(operation: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try { await client.query('BEGIN'); const result = await operation(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function audit(client: PoolClient, userId: string, action: string, entity: string, id: string, metadata: object = {}) {
  await client.query('INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES($1,$2,$3,$4,$5)', [userId, action, entity, id, JSON.stringify(metadata)]);
}
async function checkMedia(client: PoolClient, path: string) {
  await assertEditorialImage(path, client);
}
export async function saveTaxonomy(kind: TaxonomyKind, form: FormData, userId: string) {
  const table = kind === 'categories' ? 'categories' : 'authors';
  const id = text(form, 'id', 36);
  if (id) uuid(id);
  const name = text(form, 'name', 120, true);
  const itemSlug = slug(form, name);
  const description = text(form, kind === 'categories' ? 'description' : 'bio', 4000);
  const photo = kind === 'authors' ? mediaPath(text(form, 'photo_url', 200)) : '';
  const active = form.get('active') === 'on';
  return transaction(async client => {
    await checkMedia(client, photo);
    const key = id || randomUUID();
    if (id) {
      const update = kind === 'categories'
        ? await client.query('UPDATE categories SET name=$2,slug=$3,description=$4,active=$5,updated_at=now() WHERE id=$1', [id, name, itemSlug, description, active])
        : await client.query('UPDATE authors SET name=$2,slug=$3,bio=$4,photo_url=$5,active=$6,updated_at=now() WHERE id=$1', [id, name, itemSlug, description, photo, active]);
      if (!update.rowCount) throw new EditorialError('Registro não encontrado.');
    } else if (kind === 'categories') {
      await client.query('INSERT INTO categories(id,name,slug,description,active) VALUES($1,$2,$3,$4,$5)', [key,name,itemSlug,description,active]);
    } else {
      await client.query('INSERT INTO authors(id,name,slug,bio,photo_url,active) VALUES($1,$2,$3,$4,$5,$6)', [key,name,itemSlug,description,photo,active]);
    }
    await audit(client,userId,`${table}.${id ? 'update' : 'create'}`,table,key,{active});
    return key;
  });
}
export async function deleteTaxonomy(kind: TaxonomyKind, form: FormData, userId: string) {
  const id = uuid(text(form,'id',36,true));
  const table = kind === 'categories' ? 'categories' : 'authors';
  await transaction(async client => {
    const existing = await client.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`, [id]);
    if (!existing.rowCount) throw new EditorialError('Registro não encontrado.');
    const references = kind === 'categories'
      ? await client.query('SELECT 1 FROM news_categories WHERE category_id=$1 LIMIT 1', [id])
      : await client.query('SELECT 1 FROM news WHERE author_id=$1 LIMIT 1', [id]);
    if (references.rowCount) throw new EditorialError('Este registro está vinculado a notícias. Desative-o em vez de excluir.');
    const result = await client.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
    if (!result.rowCount) throw new EditorialError('Registro não encontrado.');
    await audit(client,userId,`${table}.delete`,table,id);
  });
}
export async function saveNews(form: FormData, userId: string) {
  const input = newsInput(form);
  const id = text(form, 'id', 36);
  if (id) uuid(id);
  const version = Number(text(form, 'version', 12));
  return transaction(async client => {
    const previous = id ? (await client.query('SELECT * FROM news WHERE id=$1 FOR UPDATE', [id])).rows[0] : null;
    if (id && !previous) throw new EditorialError('Notícia não encontrada.');
    if (previous && previous.version !== version) throw new EditorialError('Esta notícia foi alterada em outra aba. Recarregue a página antes de editar novamente.');
    const author = (await client.query('SELECT active,photo_url FROM authors WHERE id=$1 FOR SHARE', [input.author_id])).rows[0];
    if (!author || (!author.active && previous?.author_id !== input.author_id)) throw new EditorialError('Selecione um autor ativo.');
    await checkMedia(client, author.photo_url);
    const cats = await client.query('SELECT id,active FROM categories WHERE id=ANY($1::uuid[]) FOR SHARE', [input.categoryIds]);
    const oldCats = previous ? (await client.query('SELECT category_id FROM news_categories WHERE news_id=$1', [id])).rows.map(row => row.category_id) : [];
    if (cats.rowCount !== input.categoryIds.length || cats.rows.some(row => !row.active && !oldCats.includes(row.id))) throw new EditorialError('Selecione categorias ativas.');
    await checkMedia(client, input.cover_image);
    // O corpo permanece Markdown; referências de imagens devem ser uploads existentes.
    const imagePaths = renderedImagePaths(input.body);
    for (const path of imagePaths) await checkMedia(client,path);
    const key = id || randomUUID();
    const { categoryIds, ...fields } = input;
    const names = Object.keys(fields);
    const values: unknown[] = Object.values(fields);
    if (previous) {
      const assignments = names.map((name,index) => `${name}=$${index+1}`);
      values.push(userId,key);
      await client.query(`UPDATE news SET ${assignments.join(',')},updated_by=$${values.length-1},updated_at=now(),version=version+1 WHERE id=$${values.length}`, values);
      await client.query('DELETE FROM news_categories WHERE news_id=$1', [key]);
    } else {
      values.push(key,userId);
      await client.query(`INSERT INTO news(${names.join(',')},id,created_by,updated_by) VALUES(${names.map((_,i)=>`$${i+1}`).join(',')},$${values.length-1},$${values.length},$${values.length})`, values);
    }
    await client.query('INSERT INTO news_categories(news_id,category_id) SELECT $1,unnest($2::uuid[])', [key,categoryIds]);
    await audit(client,userId,`news.${previous ? 'update' : 'create'}`,'news',key);
    if(!previous && form.get('imported')==='1' && input.source_url) await audit(client,userId,'news.import','news',key,{source_name:input.source_name,source_host:new URL(input.source_url).hostname});
    if (!previous || previous.status !== input.status) {
      await audit(client,userId,'news.status','news',key,{from: previous?.status ?? null,to:input.status});
      const action = { PUBLISHED: 'publish', SCHEDULED: 'schedule', ARCHIVED: 'archive', DRAFT: 'draft' }[input.status];
      await audit(client,userId,`news.${action}`,'news',key,{published_at:input.published_at,scheduled_at:input.scheduled_at});
    } else if (input.status === 'SCHEDULED' && previous.scheduled_at?.toISOString() !== input.scheduled_at) {
      await audit(client,userId,'news.schedule','news',key,{scheduled_at:input.scheduled_at});
    }
    if ((!previous && input.featured) || (previous && previous.featured !== input.featured)) await audit(client,userId,'news.featured','news',key,{featured:input.featured});
    return key;
  });
}
export function editorialMessage(error: unknown) {
  if (error instanceof EditorialError) return error.message;
  const code = (error as { code?: string })?.code;
  if (code === '23505') return 'Este slug já está em uso. Escolha outro.';
  if (code === '23503') return 'Este registro está vinculado a notícias. Desative-o em vez de excluir.';
  return 'Não foi possível salvar. Verifique a conexão e tente novamente.';
}
