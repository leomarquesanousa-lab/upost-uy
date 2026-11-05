import test from 'node:test';
import assert from 'node:assert/strict';
import { extractArticle } from '../lib/editorial/import-article.mjs';
import { importArticleImages } from '../lib/editorial/import-images.mjs';
import { renderBody, renderedImagePaths } from '../lib/editorial/content.mjs';

const local = index => '/media/00000000-0000-4000-8000-' + String(index).padStart(12, '0') + '.webp';
const html = `<html><head><meta property="og:title" content="Crónica de Montevideo">
<meta property="og:site_name" content="Medio asociado"><meta property="og:image" content="/cover.jpg">
<meta name="author" content="Ana Pérez"><meta property="article:published_time" content="2026-11-03T14:00:00Z">
</head><body><article><header><h1>Crónica de Montevideo</h1><p class="subtitle">Una mirada desde la ciudad</p></header>
<p>Primer párrafo con <strong>negrita</strong>, <em>cursiva</em> y <a href="/contexto">contexto</a>.</p>
<h2>Lo que pasó</h2><p>Segundo párrafo.<br>Otra línea.</p>
<ol><li>Primero</li><li>Segundo</li></ol><blockquote><p>Una voz de la ciudad.</p></blockquote>
<figure><img src="/cover.jpg" alt="Portada"><figcaption>Foto de portada</figcaption></figure>
<figure><img src="data:image/gif;base64,placeholder" data-src="/segunda.jpg" alt="La ciudad"><figcaption>Foto de la ciudad</figcaption></figure>
<img src="/segunda.jpg"><img src="http://127.0.0.1/private.jpg">
<script>alert('injected')</script><p onclick="alert('injected')">Texto final.</p></article></body></html>`;

test('full import preserves paragraphs, structure, formatting, attribution and all article photos without a source registration', async () => {
  const extracted = extractArticle(html, 'https://partner.example/nota');
  const downloads = [];
  const article = await importArticleImages(extracted, async url => { downloads.push(url); return local(downloads.length); });
  assert.equal(article.title, 'Crónica de Montevideo');
  assert.equal(article.subtitle, 'Una mirada desde la ciudad');
  assert.equal(article.original_author, 'Ana Pérez');
  assert.equal(article.original_published_at, '2026-11-03T14:00:00.000Z');
  assert.equal(article.source_name, 'Medio asociado');
  assert.equal(article.status, 'DRAFT');
  assert.equal(article.imported_image_count, 2);
  assert.deepEqual(downloads.sort(), ['https://partner.example/cover.jpg', 'https://partner.example/segunda.jpg']);
  assert.equal(article.cover_image, local(1));
  const rendered = renderBody(article.body);
  assert.match(rendered, /<strong>negrita<\/strong>/);
  assert.match(rendered, /<em>cursiva<\/em>/);
  assert.match(rendered, /href="https:\/\/partner.example\/contexto"/);
  assert.match(rendered, /<h2>Lo que pasó<\/h2>/);
  assert.match(rendered, /<ol>/);
  assert.match(rendered, /<blockquote>/);
  assert.match(rendered, /Segundo párrafo\./);
  assert.match(rendered, /Texto final\./);
  assert.equal(renderedImagePaths(article.body).length, 2);
  assert.doesNotMatch(article.body, /UPOSTIMPORT|alert\(|onclick|127\.0\.0\.1/);
  assert.equal(article.warnings.length, 0);
});

test('unavailable photos never discard text or leave broken remote images in the editor', async () => {
  const extracted = extractArticle(html, 'https://partner.example/nota');
  const article = await importArticleImages(extracted, async url => {
    if (url.endsWith('/cover.jpg')) throw new Error('network failure');
    return local(2);
  });
  assert.equal(article.cover_image, local(2), 'A working article photograph replaces an unavailable primary image');
  assert.equal(article.imported_image_count, 1);
  assert.match(article.body, /Texto final/);
  assert.doesNotMatch(article.body, /UPOSTIMPORT|!\[.*\]\(https?:/);
  assert.match(article.warnings.join(' '), /1 imágenes/);
});

test('technical download bounds and invalid storage results retain editable text', async () => {
  const extracted = extractArticle(html, 'https://partner.example/nota');
  let calls = 0;
  const article = await importArticleImages(extracted, async () => { calls++; return 'https://external.example/not-stored.jpg'; }, { maxImages: 1 });
  assert.equal(calls, 1);
  assert.equal(article.imported_image_count, 0);
  assert.match(article.body, /Primer párrafo/);
  assert.doesNotMatch(article.body, /UPOSTIMPORT/);
  assert.match(article.warnings.join(' '), /límite técnico/);
  const timedOut = await importArticleImages(extracted, async () => { assert.fail('No new request after the budget'); }, { budgetMs: 0 });
  assert.equal(timedOut.imported_image_count, 0);
});

test('delivered JSON-LD text is a fallback, not a route around a paywall', () => {
  const json = accessible => '<script type="application/ld+json">' + JSON.stringify({
    '@type': 'NewsArticle', headline: 'Título', articleBody: 'Texto accesible.\n\nSegundo párrafo.', isAccessibleForFree: accessible,
  }) + '</script><article></article>';
  assert.match(extractArticle(json(true), 'https://partner.example/nota').body, /Segundo párrafo/);
  assert.equal(extractArticle(json(false), 'https://partner.example/nota').body, '');
});

test('the editor length bound is applied after photograph substitution', async () => {
  const extracted = extractArticle('<title>Artículo extenso</title><article><p>' + 'a'.repeat(99900) +
    '</p><img src="/foto.jpg" alt="' + 'b'.repeat(300) + '"></article>', 'https://partner.example/nota');
  const article = await importArticleImages(extracted, async () => local(1));
  assert.ok(article.body.length <= 100000);
  assert.doesNotMatch(article.body, /UPOSTIMPORT/);
  assert.ok(article.warnings.some(message => /100.000/.test(message)));
});
