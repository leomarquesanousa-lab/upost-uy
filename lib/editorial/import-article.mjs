import { load } from 'cheerio';
import { remoteUrl } from '../security/remote-page.mjs';

const clean = (value,max=1000) => typeof value==='string' ? value.replace(/\s+/g,' ').trim().slice(0,max) : '';
function safeLink(value,base) {
  if(!value || typeof value!=='string') return '';
  try { return remoteUrl(new URL(value,base).href).href; } catch { return ''; }
}
export function extractArticle(html, sourceUrl, resolvedUrl=sourceUrl) {
  const $=load(html);
  const meta=(key)=>clean($(`meta[name="${key}"],meta[property="${key}"],meta[itemprop="${key}"]`).first().attr('content'),2048);
  const nodes=[];
  function collect(value,depth=0) {
    if(!value || depth>8 || nodes.length>200) return;
    if(Array.isArray(value)) {value.forEach(item=>collect(item,depth+1));return;}
    if(typeof value==='object') {nodes.push(value);if(value['@graph'])collect(value['@graph'],depth+1);}
  }
  $('script[type="application/ld+json"]').slice(0,20).each((_,el)=>{try{collect(JSON.parse($(el).text()));}catch{}});
  const article=nodes.find(node=>[node['@type']].flat().some(type=>['NewsArticle','Article','ReportageNewsArticle','BlogPosting'].includes(type))) || {};
  const person=Array.isArray(article.author)?article.author[0]:article.author;
  const image=Array.isArray(article.image)?article.image[0]:article.image;
  const imageObject=typeof image==='object' && image ? image : {};
  $('script,style,iframe,form,nav,footer,header,aside,svg,noscript,button,[hidden],[aria-hidden="true"]').remove();
  let main=$('[itemprop="articleBody"]').first();
  if(!main.length) main=$('article').first();
  if(!main.length) main=$('main').first();
  if(!main.length) {
    const candidates=$('section,div').toArray().filter(el=>$(el).children('p').length>=2);
    candidates.sort((a,b)=>$(b).children('p').text().length-$(a).children('p').text().length);
    main=candidates.length?$(candidates[0]):$('body');
  }
  const title=clean(meta('headline') || meta('og:title') || article.headline || main.find('h1').first().text() || $('h1').first().text() || $('title').text(),240);
  const excerpt=clean(meta('description') || meta('og:description') || article.description,600);
  const blocks=[];
  const escape=(text)=>text.replace(/[\\`*_{}\[\]<>]/g,'\\$&');
  if(typeof article.articleBody==='string' && article.articleBody.trim()) {
    blocks.push(...article.articleBody.split(/\n+/).map(part=>escape(clean(part,100000))).filter(Boolean));
  } else {
    main.find('h2,h3,p,li,blockquote').each((_,el)=>{
      if(blocks.length>=300 || $(el).parents('blockquote,li').length) return;
      const text=escape(clean($(el).text(),10000));
      if(!text || text===title) return;
      const tag=el.tagName.toLowerCase();
      blocks.push(`${tag==='h2'?'## ':tag==='h3'?'### ':tag==='li'?'- ':tag==='blockquote'?'> ':''}${text}`);
    });
  }
  const leadImage=main.find('figure img,img').first();
  const published=meta('article:published_time') || clean(article.datePublished) || clean($('time[datetime]').first().attr('datetime'));
  return {
    status:'DRAFT',title,subtitle:clean($('[itemprop="alternativeHeadline"],.subtitle,.subheadline').first().text(),400),excerpt,
    body:blocks.join('\n\n').slice(0,100000),
    external_image_url:safeLink(meta('og:image') || imageObject.url || (typeof image==='string'?image:'') || leadImage.attr('src'),resolvedUrl),
    cover_alt:clean(meta('og:image:alt') || imageObject.description || leadImage.attr('alt'),300),
    cover_caption:clean(imageObject.caption || main.find('figcaption').first().text(),500),
    cover_credit:clean(imageObject.creditText || meta('image:credit'),200),
    original_author:clean(meta('author') || (typeof person==='string'?person:person?.name) || $('[rel="author"],[itemprop="author"]').first().text(),120),
    original_published_at:published && Number.isFinite(Date.parse(published))?new Date(published).toISOString():'',
    source_name:clean(meta('og:site_name') || article.publisher?.name || meta('application-name'),200),
    source_url:remoteUrl(sourceUrl).href,
  };
}
