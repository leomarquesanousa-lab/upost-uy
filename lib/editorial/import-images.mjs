import { mediaPattern } from './content.mjs';

const escapeAlt = value => String(value || '').replace(/[\\\[\]<>]/g, '').replace(/\s+/g, ' ').slice(0, 300);

// Bound remote work; every download still uses the SSRF-safe image transport.
export async function importArticleImages(article, persist, { maxImages = 24, budgetMs = 45000, now = Date.now } = {}) {
  const candidates = [...(article.cover_candidates || []), ...(article.external_images || [])];
  if (article.external_image_url && !candidates.some(image => image.url === article.external_image_url)) {
    candidates.unshift({ url: article.external_image_url, alt: article.cover_alt, placeholder: '' });
  }
  const unique = [...new Map(candidates.map(image => [image.url, image])).values()];
  const selected = unique.slice(0, maxImages);
  const local = new Map();
  const started = now();
  let next = 0;
  async function worker() {
    while (next < selected.length) {
      const image = selected[next++];
      if (now() - started >= budgetMs) continue;
      try {
        const path = await persist(image.url);
        if (mediaPattern.test(path)) local.set(image.url, path);
      } catch { /* Preserve the text when a photograph is unavailable. */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, selected.length) }, () => worker()));
  let body = article.body;
  for (const image of candidates) {
    if (!image.placeholder) continue;
    const path = local.get(image.url);
    body = body.split(image.placeholder).join(path ? '![' + escapeAlt(image.alt) + '](' + path + ')' : '');
  }
  const missing = unique.length - local.size;
  const cover = (article.cover_candidates || [{ url: article.external_image_url }]).find(image => local.has(image.url));
  const warnings = [...(article.warnings || [])];
  if (missing) warnings.push('No se pudieron importar ' + missing + ' imágenes por acceso, formato, tamaño o tiempo de descarga. El texto sigue disponible para editar.');
  if (unique.length > maxImages) warnings.push('Se alcanzó el límite técnico de ' + maxImages + ' fotografías por importación.');
  if (body.length > 100000) {
    const paragraph = body.lastIndexOf('\n\n', 100000);
    body = body.slice(0, paragraph > 90000 ? paragraph : 100000);
    warnings.push('Se alcanzó el límite técnico de 100.000 caracteres del editor.');
  }
  return {
    ...article, body: body.replace(/\n{3,}/g, '\n\n').trim(),
    cover_image: cover ? local.get(cover.url) : '', warnings,
    cover_alt: cover?.alt || article.cover_alt,
    cover_caption: cover?.caption || article.cover_caption,
    cover_credit: cover?.credit || article.cover_credit,
    imported_image_count: local.size,
  };
}
