import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { remoteUrl } from '../security/remote-page.mjs';

export function databaseIdentity(value) {
  const url = new URL(value);
  if (!url.hostname.endsWith('.neon.tech') || /biosfera/i.test(url.hostname + url.pathname + url.username)) {
    throw new Error('A carga inicial exige o Neon exclusivo configurado para o UPOST.');
  }
  return {
    database: decodeURIComponent(url.pathname.slice(1)),
    fingerprint: createHash('sha256').update(url.hostname + '|' + url.pathname + '|' + decodeURIComponent(url.username)).digest('hex').slice(0, 16),
  };
}
export function normalizedSourceUrl(value) {
  const url = remoteUrl(value);
  for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  return url.href;
}
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
export function parseNewsFeed(xml) {
  const $ = load(xml, { xmlMode: true });
  return $('item,entry').toArray().map(node => {
    const entry = $(node);
    const link = entry.find('link').first();
    const rawUrl = clean(link.text() || link.attr('href'));
    let url;
    try { url = normalizedSourceUrl(rawUrl); } catch { return null; }
    const date = clean(entry.find('pubDate,published,updated').first().text());
    return {
      title: clean(entry.find('title').first().text()), url,
      publishedAt: Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : '',
      description: clean(load(entry.find('description,summary').first().text()).text()),
    };
  }).filter(entry => entry?.title && entry.publishedAt);
}
export function summaryForm(item, { authorId, categoryId, title = item.title, url = item.url, publishedAt = item.publishedAt, originalAuthor = '' }, now = Date.now()) {
  if (!item.summary?.trim() || item.summary.length > 600) throw new Error('Resumo ausente ou maior que 600 caracteres.');
  const time = Date.parse(publishedAt);
  if (!Number.isFinite(time) || time > now || now - time > 7 * 86400000) throw new Error('A matéria deve ser recente, com data verificada e não futura.');
  const source = normalizedSourceUrl(url);
  const safe = value => clean(value).replace(/[\\\[\]<>*_]/g, '');
  const body = item.summary.trim() + '\n\n[Leé la información completa en ' + safe(item.sourceName) + '](' + source.replace(/\(/g, '%28').replace(/\)/g, '%29') + ').' +
    (originalAuthor ? '\n\nAutoría original: ' + safe(originalAuthor) + '.' : '');
  const form = new FormData();
  for (const [key, value] of Object.entries({
    title, body, excerpt: item.summary.trim(), subtitle: '', author_id: authorId,
    status: 'PUBLISHED', published_at: new Date(time).toISOString(), source_name: item.sourceName,
    source_url: source, canonical_url: source, imported: '1',
  })) form.set(key, value);
  form.set('category_ids', categoryId);
  if (item.featured) form.set('featured', 'on');
  // No external text body or image is copied in this demonstration batch.
  return form;
}
