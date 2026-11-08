import { load } from 'cheerio';
import { randomUUID } from 'node:crypto';
import { remoteUrl } from '../security/remote-page.mjs';
import { discoverCoverImages, photoUrl, isInfobae } from './cover-images.mjs';
import {isMediosPublicos} from './medios-publicos.mjs';

const clean = (value, max = 1000) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const escape = value => value.replace(/[\\`*_{}\[\]<>]/g, '\\$&');
function safeLink(value, base) {
  if (!value || typeof value !== 'string') return '';
  try { return remoteUrl(new URL(value, base).href).href; } catch { return ''; }
}
function markdownUrl(value) {
  return value.replace(/\(/g, '%28').replace(/\)/g, '%29');
}

export function extractArticle(html, sourceUrl, resolvedUrl = sourceUrl, options = {}) {
  const $ = load(html);
  const meta = key => clean($('meta').filter((_, el) =>
    ['name', 'property', 'itemprop'].some(attr => $(el).attr(attr) === key)).first().attr('content'), 2048);
  const nodes = [];
  function collect(value, depth = 0) {
    if (!value || depth > 8 || nodes.length > 200) return;
    if (Array.isArray(value)) { value.forEach(item => collect(item, depth + 1)); return; }
    if (typeof value === 'object') { nodes.push(value); if (value['@graph']) collect(value['@graph'], depth + 1); }
  }
  $('script[type="application/ld+json"]').slice(0, 20).each((_, el) => {
    try { collect(JSON.parse($(el).text())); } catch {}
  });
  const article = nodes.find(node => [node['@type']].flat().some(type =>
    ['NewsArticle', 'Article', 'ReportageNewsArticle', 'BlogPosting'].includes(type))) || {};
  const person = Array.isArray(article.author) ? article.author[0] : article.author;
  const schemaImages = [article.image].flat().filter(Boolean);
  const image = schemaImages[0];
  const imageObject = typeof image === 'object' && image ? image : {};

  // Capture attribution before removing page furniture, including article headers.
  const originalAuthor = clean(meta('author') || (typeof person === 'string' ? person : person?.name) ||
    $('[rel="author"],[itemprop="author"],.byline,.article-author,.author-name').first().text(), 120);
  let published = meta('article:published_time') || clean(article.datePublished) ||
    clean($('time[datetime]').first().attr('datetime'));
  // Gub.uy publishes a calendar date (not a timestamp) in its public Page-date.
  // Interpret that original day in Uruguay; never substitute the import time.
  if (!published && /(^|\.)gub\.uy$/.test(new URL(resolvedUrl).hostname)) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean($('.Page-date').first().text()));
    if (match) {
      const [,day,month,year] = match, calendar = `${year}-${month}-${day}`;
      const time = Date.parse(calendar + 'T00:00:00-03:00');
      if (Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === calendar) published = new Date(time).toISOString();
    }
  }
  const subtitle = clean(article.alternativeHeadline ||
    (isMediosPublicos(resolvedUrl) ? $('h1').parent().find('h3').first().text() : '') ||
    $('[itemprop="alternativeHeadline"],.subtitle,.subheadline,.subheading').first().text() ||
    meta('description') || meta('og:description'), 400);

  $('script,style,iframe,form,nav,footer,aside,svg,noscript,button,[hidden],[aria-hidden="true"],body > header').remove();
  let main = isMediosPublicos(resolvedUrl) ? $('.single-cont').first() : $('[itemprop="articleBody"]').first();
  if (!main.length) main = $('.article-body,.article-content,.entry-content,.post-content').first();
  if (!main.length) main = $('article').first();
  if (!main.length) main = $('main').first();
  if (!main.length) {
    const candidates = $('section,div').toArray().filter(el => $(el).children('p').length >= 2);
    candidates.sort((a, b) => $(b).children('p').text().length - $(a).children('p').text().length);
    main = candidates.length ? $(candidates[0]) : $('body');
  }
  const title = clean(meta('headline') || meta('og:title') || article.headline ||
    main.find('h1').first().text() || $('h1').first().text() || $('title').text(), 240);
  const excerpt = clean(meta('description') || meta('og:description') || article.description, 600);
  const coverCandidates = discoverCoverImages(html, resolvedUrl, { ...options, title });
  const primary = coverCandidates[0];
  const leadImage = main.find('figure img,img').first();
  const srcset = value => value?.split(',').map(entry => entry.trim().split(/\s+/)[0]).filter(Boolean).at(-1);
  const imageUrl = el => {
    const element = $(el);
    return [element.attr('data-src'), element.attr('data-original'), element.attr('data-lazy-src'),
      srcset(element.attr('data-srcset')), srcset(element.attr('srcset')), element.attr('src')]
      .map(value => safeLink(value, resolvedUrl)).find(Boolean) || '';
  };
  const coverUrl = isInfobae(resolvedUrl)||isMediosPublicos(resolvedUrl) ? primary?.url || '' : primary?.url || [meta('og:image'), imageObject.url, imageObject.contentUrl, typeof image === 'string' ? image : '']
    .map(value => safeLink(value, resolvedUrl)).find(Boolean) || imageUrl(leadImage);
  const externalImages = [];
  const imagePrefix = 'UPOSTIMPORT' + randomUUID().replaceAll('-', '') + 'IMAGE';
  const byUrl = new Map();
  function registerImage(url, alt = '', caption = '') {
    url = photoUrl(url, resolvedUrl);
    if (!url) return '';
    let entry = byUrl.get(url);
    if (!entry) {
      entry = { url, alt: clean(alt, 300), caption: clean(caption, 500),
        placeholder: imagePrefix + externalImages.length + 'END' };
      byUrl.set(url, entry);
      externalImages.push(entry);
    }
    return entry.placeholder;
  }
  registerImage(coverUrl, meta('og:image:alt') || imageObject.description || leadImage.attr('alt'),
    imageObject.caption || main.find('figcaption').first().text());

  main.find('h1,[itemprop="alternativeHeadline"],.subtitle,.subheadline,.subheading,.byline,.article-author').remove();
  const renderedImages = new Set();
  function render(node, depth = 0) {
    if (depth > 60) return '';
    if (node.type === 'text') return escape((node.data || '').replace(/\s+/g, ' '));
    const tag = node.tagName?.toLowerCase();
    if (!tag) return '';
    const children = () => (node.children || []).map(child => render(child, depth + 1)).join('');
    if (tag === 'img') {
      const marker = registerImage(imageUrl(node), $(node).attr('alt'), $(node).closest('figure').find('figcaption').first().text());
      if (!marker || renderedImages.has(marker)) return '';
      renderedImages.add(marker);
      return '\n\n' + marker + '\n\n';
    }
    if (['script', 'style', 'iframe', 'form', 'input', 'button', 'video', 'audio', 'source'].includes(tag)) return '';
    if (tag === 'br') return '  \n';
    if (tag === 'hr') return '\n\n---\n\n';
    if (tag === 'strong' || tag === 'b') return '**' + children().trim() + '**';
    if (tag === 'em' || tag === 'i') return '*' + children().trim() + '*';
    if (tag === 'del' || tag === 's') return '~~' + children().trim() + '~~';
    if (tag === 'a') {
      const url = safeLink($(node).attr('href'), resolvedUrl), label = children().trim();
      return url && label ? '[' + label + '](' + markdownUrl(url) + ')' : label;
    }
    if (tag === 'ul' || tag === 'ol') {
      return '\n\n' + $(node).children('li').toArray().map((li, index) => {
        const text = (li.children || []).map(child => render(child, depth + 1)).join('').trim();
        const prefix = tag === 'ol' ? (index + 1) + '. ' : '- ';
        return prefix + text.replace(/\n/g, '\n' + ' '.repeat(prefix.length));
      }).join('\n') + '\n\n';
    }
    if (tag === 'blockquote') return '\n\n' + children().trim().split('\n').map(line => '> ' + line).join('\n') + '\n\n';
    if (/^h[2-6]$/.test(tag)) return '\n\n' + '#'.repeat(Number(tag[1])) + ' ' + children().trim() + '\n\n';
    if (tag === 'figcaption') return '\n\n' + children().trim() + '\n\n';
    if (['p', 'div', 'section', 'article', 'main', 'figure', 'header'].includes(tag)) return '\n\n' + children().trim() + '\n\n';
    return children();
  }
  let body = main.contents().toArray().map(node => render(node)).join('').replace(/\n{3,}/g, '\n\n').trim();
  // JSON-LD is a fallback for normally accessible delivered content, not a paywall bypass.
  if (!main.find('p,li,blockquote,h2,h3').text().trim() && typeof article.articleBody === 'string' &&
      article.isAccessibleForFree !== false && article.isAccessibleForFree !== 'false') {
    body = article.articleBody.split(/\n+/).map(part => escape(clean(part, 100000))).filter(Boolean).join('\n\n');
    body += externalImages.filter(entry => entry.url !== coverUrl).map(entry => '\n\n' + entry.placeholder).join('');
    for (const entry of externalImages) renderedImages.delete(entry.placeholder);
  }
  for (const entry of schemaImages) {
    const data = typeof entry === 'object' ? entry : {};
    const url = safeLink(typeof entry === 'string' ? entry : data.url || data.contentUrl, resolvedUrl);
    const marker = registerImage(url, data.description, data.caption);
    if (marker && url !== coverUrl && !renderedImages.has(marker)) {
      body += '\n\n' + marker;
      renderedImages.add(marker);
    }
  }
  const warnings = body.length > 100000 ? ['El artículo supera el límite de 100.000 caracteres; se importó el contenido hasta ese límite.'] : [];
  return {
    status: 'DRAFT', title, subtitle, excerpt, body, external_images: externalImages,
    external_image_url: coverUrl, cover_candidates: coverCandidates,
    cover_alt: clean(primary?.alt || meta('og:image:alt') || imageObject.description || leadImage.attr('alt'), 300),
    cover_caption: clean(primary?.caption || imageObject.caption || main.find('figcaption').first().text(), 500),
    cover_credit: clean(primary?.credit || imageObject.creditText || meta('image:credit'), 200),
    original_author: originalAuthor,
    original_published_at: published && Number.isFinite(Date.parse(published)) ? new Date(published).toISOString() : '',
    source_name: clean(meta('og:site_name') || article.publisher?.name || meta('application-name'), 200),
    source_url: remoteUrl(sourceUrl).href, warnings,
  };
}
