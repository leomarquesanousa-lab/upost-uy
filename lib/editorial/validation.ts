import { mediaPattern, plainText } from './content.mjs';
import { slugify, statuses, type NewsStatus } from './shared';
export { statuses, statusLabels, type NewsStatus } from './shared';
export class EditorialError extends Error {}
export function text(form: FormData, key: string, max: number, required = false) {
  const value = form.get(key);
  if (value !== null && typeof value !== 'string') throw new EditorialError('Campo inválido.');
  const result = (value || '').trim();
  if (result.length > max || (required && !result)) throw new EditorialError(`Revise o campo ${key}: ${required ? 'obrigatório, ' : ''}máximo de ${max} caracteres.`);
  return result;
}
export function uuid(value: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new EditorialError('Identificador inválido.');
  return value;
}
export function slug(form: FormData, title: string) {
  const value = text(form, 'slug', 180) || slugify(title);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) throw new EditorialError('Slug deve conter letras minúsculas, números e hífens.');
  return value;
}
export function mediaPath(value: string) {
  if (value && !mediaPattern.test(value)) throw new EditorialError('Selecione uma imagem enviada pelo portal.');
  return value;
}
function date(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw new EditorialError('Data inválida.');
  const parsed = new Date(value);
  if (parsed.getUTCFullYear() < 2000 || parsed.getUTCFullYear() > 2100) throw new EditorialError('Data fora do intervalo permitido.');
  return parsed.toISOString();
}
export function newsInput(form: FormData) {
  const title = text(form, 'title', 240, true);
  const body = text(form, 'body', 100000, true);
  if (!plainText(body)) throw new EditorialError('Escreva conteúdo textual para a notícia.');
  const status = text(form, 'status', 20) as NewsStatus;
  if (!statuses.includes(status)) throw new EditorialError('Status inválido.');
  const categoryIds = [...new Set(form.getAll('category_ids').map(value => uuid(String(value))))];
  if (!categoryIds.length || categoryIds.length > 20) throw new EditorialError('Selecione de 1 a 20 categorias.');
  const cover = mediaPath(text(form, 'cover_image', 200));
  const coverAlt = text(form, 'cover_alt', 300, Boolean(cover));
  let published = date(text(form, 'published_at', 30));
  const scheduled = date(text(form, 'scheduled_at', 30));
  if (status === 'PUBLISHED') {
    published ||= new Date().toISOString();
    if (Date.parse(published) > Date.now()) throw new EditorialError('Para data futura, utilize o status Agendada.');
  }
  if (status === 'SCHEDULED' && !scheduled) throw new EditorialError('Informe a data de agendamento.');
  const canonical = text(form, 'canonical_url', 2048);
  const sourceUrl = text(form, 'source_url', 2048);
  if(sourceUrl) {
    try { const url=new URL(sourceUrl); if(!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error(); }
    catch { throw new EditorialError('URL da fonte inválida.'); }
  }
  if (canonical) {
    try { const url = new URL(canonical); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error(); }
    catch { throw new EditorialError('URL canônica inválida. Use uma URL completa HTTP(S), sem credenciais ou fragmento.'); }
  }
  return {
    title, slug: slug(form, title), subtitle: text(form, 'subtitle', 400), excerpt: text(form, 'excerpt', 600), body,
    cover_image: cover, cover_alt: coverAlt, cover_caption: text(form, 'cover_caption', 500), cover_credit: text(form, 'cover_credit', 200),
    author_id: uuid(text(form, 'author_id', 36, true)), status, published_at: published,
    scheduled_at: status === 'SCHEDULED' ? scheduled : null, featured: form.get('featured') === 'on',
    seo_title: text(form, 'seo_title', 120), seo_description: text(form, 'seo_description', 300), canonical_url: canonical,
    source_name: text(form, 'source_name', 200), source_url: sourceUrl,
    categoryIds,
  };
}
