'use server';
import { requireMutation } from '@/lib/auth/editorial';
import { fetchRemotePage, fetchRemoteFeed, ImportError, remoteUrl } from '@/lib/security/remote-page.mjs';
import { discoverFeedUrl } from '@/lib/editorial/cover-images.mjs';
import { extractArticle } from '@/lib/editorial/import-article.mjs';
import { importArticleImages } from '@/lib/editorial/import-images.mjs';
import { consumeLimit } from '@/server/services/request-limit';
import { importEditorialImage } from '@/server/services/import-editorial-image';
import { getPool } from '@/lib/db/pool';

export async function importArticle(url: string) {
  try {
    const user = await requireMutation();
    if (typeof url !== 'string' || url.length > 2048) return { error: 'URL inválida.' };
    const originalUrl = remoteUrl(url).href;
    if (!await consumeLimit('import:' + user.id, 10, 600)) return { error: 'Límite de importaciones alcanzado. Esperá 10 minutos.' };
    const existing = await getPool().query('SELECT id FROM news WHERE source_url=$1 LIMIT 1', [originalUrl]);
    if (existing.rowCount) return { error: 'Esta noticia ya fue importada. Buscala en Noticias para editarla.' };
    const page = await fetchRemotePage(originalUrl);
    if (!page) return { error: 'La fuente no devolvió contenido.' };
    const duplicate = await getPool().query('SELECT id FROM news WHERE source_url=$1 LIMIT 1', [page.url]);
    if (duplicate.rowCount) return { error: 'Esta noticia ya fue importada. Buscala en Noticias para editarla.' };
    let extracted = extractArticle(page.html, originalUrl, page.url);
    if (!extracted.cover_candidates.length) {
      const feedUrl = discoverFeedUrl(page.html, page.url);
      if (feedUrl) try {
        const feed = await fetchRemoteFeed(feedUrl);
        extracted = extractArticle(page.html, originalUrl, page.url, { feedXml: feed.html });
      } catch { /* An inaccessible feed must not discard the article. */ }
    }
    if (!extracted.title) return { error: 'No se pudo identificar el artículo. Completalo manualmente.' };
    const article = await importArticleImages(extracted, (imageUrl: string) => importEditorialImage(imageUrl, user.id));
    if (!article.body) article.warnings.push('La página no expuso el texto del artículo. Podés completarlo en el editor.');
    await getPool().query(
      'INSERT INTO audit_log(user_id,action,entity,metadata) VALUES($1,$2,$3,$4)',
      [user.id, 'news.import.preview', 'news', JSON.stringify({ source_host: new URL(originalUrl).hostname, images: article.imported_image_count })],
    );
    return { article: { ...article, source_url: page.url, canonical_url: page.url, source_name: article.source_name || new URL(page.url).hostname } };
  } catch (error) {
    return { error: error instanceof ImportError ? error.message : 'Importación no disponible. Revisá la sesión y la conexión.' };
  }
}
