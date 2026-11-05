import { load } from 'cheerio';
import { remoteUrl } from '../security/remote-page.mjs';

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
export function photoUrl(value, base) {
  try {
    if (!value) return '';
    const url = remoteUrl(new URL(value, base).href);
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
  const add = (url, details = {}, origin = 'html') => {
    url = photoUrl(url, base);
    if (!url) return;
    const existing = images.find(item => item.url === url);
    const item = { url, alt: clean(details.alt).slice(0, 300), caption: clean(details.caption).slice(0, 500), credit: clean(details.credit).slice(0, 200), origin };
    if (existing) { for (const field of ['alt', 'caption', 'credit']) existing[field] ||= item[field]; }
    else images.push(item);
  };
  const meta = name => $('meta').filter((_, el) => [$(el).attr('property'), $(el).attr('name')].includes(name)).first().attr('content');
  const area = $('article,main,[itemprop="articleBody"]').first();
  (area.length ? area : $('body')).find('img').each((_, el) => {
    const image = $(el);
    if (image.closest('nav,aside,footer').length) return;
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
    if ([value['@type']].flat().some(type => ['ImageObject', 'Photograph'].includes(type))) add(value.contentUrl || value.url, { alt: value.description, caption: value.caption, credit: value.creditText || value.creator?.name }, 'json-ld');
    for (const image of [value.image, value.primaryImageOfPage, value.thumbnailUrl].flat().filter(Boolean)) {
      if (typeof image === 'string') add(image, {}, 'json-ld');
      else add(image.contentUrl || image.url, { alt: image.description, caption: image.caption, credit: image.creditText || image.creator?.name }, 'json-ld');
    }
    if (value['@graph']) schema(value['@graph'], depth + 1);
  }
  $('script[type="application/ld+json"]').each((_, el) => { try { schema(JSON.parse($(el).text())); } catch {} });
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
