import { load } from 'cheerio';
import { remoteUrl } from '../security/remote-page.mjs';
import {isMediosPublicos,mediosPublicosPhoto} from './medios-publicos.mjs';

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
export function isInfobae(base) { return /(^|\.)infobae\.com$/i.test(new URL(base).hostname); }
export function editorialPhoto(value, base, alt = '') {
  if(isMediosPublicos(base))return mediosPublicosPhoto(value,alt);
  if (!isInfobae(base)) return true;
  try {
    const url = new URL(value, base), pathname = decodeURIComponent(url.pathname);
    return !/(?:^|[\/_.-])(?:logos?|icons?|favicons?|placeholders?|fallback|avatars?|spacer|pixel)(?:[\/_.-]|$)|author-service-images|arc-authors|cobertura|default[-_]promo/i.test(pathname)
      && !/^\s*infobae(?:\.com)?\s*$/i.test(alt)
      && !(Number(url.searchParams.get('width')) > 0 && Number(url.searchParams.get('width')) <= 96);
  } catch { return false; }
}
export function photoUrl(value, base) {
  try {
    if (!value) return '';
    const url = remoteUrl(new URL(value, base).href);
    if (!editorialPhoto(url.href, base)) return '';
    if (/\.(svg|ico)$/i.test(url.pathname) || /(?:^|[\/_.-])(ico|icon|avatar|spacer|pixel|sprite)(?:[\/_.-]|$)/i.test(url.pathname)) return '';
    return url.href;
  } catch { return ''; }
}
const key = value => new URL(value).pathname.split('/').pop().replace(/_(article_main|schema_image|\d+w)(?=\.)/i, '').replace(/\.(webp|jpe?g|png)$/i, '');
const credit = value => clean(value).match(/(?:Foto(?:grafía)?|Crédito(?:s)?|Photo(?:graph)?|Credit(?:s)?)\s*:\s*(.+)$/i)?.[1]?.trim() || '';

export function discoverFeedUrl(html, base) {
  const $ = load(html);
  return photoUrl($('link[rel="alternate"]').filter((_, el) => /(?:rss|atom)\+xml/i.test($(el).attr('type') || '')).first().attr('href'), base);
}

export function discoverCoverImages(html, base, { feedXml = '', title = '' } = {}) {
  const $ = load(html);
  const images = [], body = [];
  const infobae = isInfobae(base), medios=isMediosPublicos(base), logos = new Set();
  const schemas = [];
  function branding(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 10) return;
    if (Array.isArray(value)) { value.forEach(entry => branding(entry, depth + 1)); return; }
    const logo = value.logo;
    for (const entry of [logo].flat().filter(Boolean)) {
      try { logos.add(new URL(typeof entry === 'string' ? entry : entry.url || entry.contentUrl, base).pathname); } catch {}
    }
    if (value['@graph']) branding(value['@graph'], depth + 1);
    if (value.publisher) branding(value.publisher, depth + 1);
  }
  $('script[type="application/ld+json"]').each((_, el) => { try { const value=JSON.parse($(el).text()); schemas.push(value); if(infobae)branding(value); } catch {} });
  const add = (url, details = {}, origin = 'html') => {
    url = photoUrl(url, base);
    if (!url || !editorialPhoto(url, base, details.alt) || (infobae && logos.has(new URL(url).pathname))) return;
    const existing = images.find(item => item.url === url);
    const item = { url, alt: clean(details.alt).slice(0, 300), caption: clean(details.caption).slice(0, 500), credit: clean(details.credit).slice(0, 200), origin };
    if (existing) { for (const field of ['alt', 'caption', 'credit']) existing[field] ||= item[field]; }
    else images.push(item);
  };
  const meta = name => $('meta').filter((_, el) => [$(el).attr('property'), $(el).attr('name')].includes(name)).first().attr('content');
  let area = medios ? $('.thumb').first() : infobae ? $('.body-article,.body-blogging-article,[itemprop="articleBody"]').first() : $('article,main,[itemprop="articleBody"]').first();
  if (infobae && !area.length) area = $('article').first();
  (area.length ? area : infobae||medios ? $() : $('body')).find('img').each((_, el) => {
    const image = $(el);
    if (image.closest('nav,aside,footer').length) return;
    if (infobae && image.closest('.feed-list-card,.latest-feed-special-card,.author-image-header,.cobertura-en-vivo').length) return;
    let caption = image.attr('data-caption') || '';
    let ancestor = image.parent();
    for (let depth = 0; depth < 4 && ancestor.length && !caption; depth++, ancestor = ancestor.parent()) {
      caption = ancestor.find('figcaption,.caption,.photo-credit,.image-caption').first().text();
    }
    const url = [image.attr('data-src'), image.attr('data-original'),
      image.attr('srcset')?.split(',').at(-1)?.trim().split(/\s+/)[0], image.attr('src')]
      .map(value => photoUrl(value, base)).find(Boolean);
    if (url) body.push({ url, alt: image.attr('alt'), caption: clean(caption), credit: credit(caption) });
  });
  add(meta('og:image') || meta('og:image:secure_url'), { alt: meta('og:image:alt') }, 'og');
  add(meta('twitter:image') || meta('twitter:image:src'), { alt: meta('twitter:image:alt') }, 'twitter');
  function schema(value, depth = 0) {
    if (!value || depth > 10) return;
    if (Array.isArray(value)) { value.forEach(item => schema(item, depth + 1)); return; }
    if (typeof value !== 'object') return;
    if (infobae && [value['@type']].flat().some(type => ['Organization','NewsMediaOrganization','WebSite','Person'].includes(type))) return;
    if ([value['@type']].flat().some(type => ['ImageObject', 'Photograph'].includes(type))) add(value.contentUrl || value.url, { alt: value.description, caption: value.caption, credit: value.creditText || value.creator?.name }, 'json-ld');
    for (const image of [value.image, value.primaryImageOfPage, value.thumbnailUrl].flat().filter(Boolean)) {
      if (typeof image === 'string') add(image, {}, 'json-ld');
      else add(image.contentUrl || image.url, { alt: image.description, caption: image.caption, credit: image.creditText || image.creator?.name }, 'json-ld');
    }
    if (value['@graph']) schema(value['@graph'], depth + 1);
  }
  schemas.forEach(value => schema(value));
  if (feedXml) {
    const feed = load(feedXml, { xmlMode: true });
    feed('item,entry').filter((_, el) => {
      const link = feed(el).find('link').first();
      return clean(feed(el).find('title').first().text()) === title || photoUrl(link.text() || link.attr('href'), base) === base;
    }).each((_, el) => {
      const item = feed(el), description = load(item.find('description,summary,content').first().text());
      item.find('*').filter((_, node) => /^(enclosure|media:content|media:thumbnail)$/.test(node.tagName)).each((_, node) => add(feed(node).attr('url'), { credit: item.find('media\\:credit').first().text() }, 'rss'));
      description('img').each((_, node) => add(description(node).attr('src'), { alt: description(node).attr('alt'), credit: credit(description(node).attr('alt')) }, 'rss'));
    });
  }
  for (const image of body) add(image.url, image);
  for (const image of images) {
    const match = body.find(candidate => key(candidate.url) === key(image.url));
    if (match) { image.alt ||= clean(match.alt); image.caption ||= match.caption; image.credit ||= match.credit; }
    image.credit ||= credit(image.caption);
    image.caption = image.caption.replace(/\s*(?:[·|]\s*)?(?:Foto(?:grafía)?|Crédito(?:s)?|Photo(?:graph)?|Credit(?:s)?)\s*:.*$/i, '').trim();
  }
  return images;
}
