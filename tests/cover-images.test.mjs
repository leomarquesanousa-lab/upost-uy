import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverCoverImages, photoUrl, editorialPhoto } from '../lib/editorial/cover-images.mjs';
import { extractArticle } from '../lib/editorial/import-article.mjs';
test('covers use OG, Twitter, JSON-LD, RSS and HTML in order, with photographic credits', () => {
 const html = '<meta property="og:image" content="/photo_article_main.webp"><meta name="twitter:image" content="/twitter.jpg"><script type="application/ld+json">{"@type":"NewsArticle","image":{"url":"/schema.jpg","creditText":"Agencia"}}</script><article><figure><img src="/photo_1200w.webp" alt="La ciudad"><figcaption>Montevideo · Foto: Ana Pérez</figcaption></figure><img src="/ico-share.svg"></article>';
 const feed = '<rss><channel><item><title>Nota</title><link>https://source.example/nota</link><description><![CDATA[<img src="/rss.jpg" alt="Foto: Fotógrafo RSS">]]></description></item></channel></rss>';
 const covers = discoverCoverImages(html, 'https://source.example/nota', {feedXml:feed,title:'Nota'});
 assert.deepEqual(covers.map(i=>i.origin).slice(0,4), ['og','twitter','json-ld','rss']);
 assert.equal(covers[0].credit,'Ana Pérez'); assert.equal(covers[0].caption,'Montevideo');
 assert.equal(covers[2].credit,'Agencia'); assert.equal(covers[3].credit,'Fotógrafo RSS');
 assert.equal(covers.some(i=>i.url.endsWith('.svg')),false);
});
test('Twitter-only cover and body captions are available to the existing importer', () => {
 const article=extractArticle('<title>Nota</title><meta name="twitter:image" content="/hero.jpg"><article><div><img src="/hero.jpg"><p class="caption">Foto: Enzo Santos -FocoUy</p></div><p>Contenido.</p></article>','https://source.example/nota');
 assert.equal(article.external_image_url,'https://source.example/hero.jpg');
 assert.equal(article.cover_credit,'Enzo Santos -FocoUy');
 assert.equal(article.cover_candidates.length,1);
});
test('image discovery rejects private URLs, scripts and interface icons', () => {
 for(const url of ['http://127.0.0.1/a.jpg','javascript:alert(1)','/ico-share.svg','/avatar.png'])assert.equal(photoUrl(url,'https://source.example'),'');
 assert.equal(photoUrl('/foto.jpg','https://source.example'),'https://source.example/foto.jpg');
});

test('Infobae rejects fallback logos and prefers the actual editorial photo with its credit', () => {
 const base='https://www.infobae.com/america/nota/';
 const html='<meta property="og:image" content="/assets/images/logos/fallback-promo-image-1200x630.png"><meta name="twitter:image" content="/resizer/v2/PHOTO.jpg"><script type="application/ld+json">{"@type":"NewsMediaOrganization","logo":{"url":"/resizer/v2/BRAND.png"},"image":"/resizer/v2/BRAND.png"}</script><div class="body-article"><figure><img src="/resizer/v2/PHOTO.jpg" alt="La ciudad"><figcaption>La ciudad · Foto: Agencia</figcaption></figure><img src="/resizer/v2/BRAND.png"></div>';
 const covers=discoverCoverImages(html,base);
 assert.equal(covers[0].url,new URL('/resizer/v2/PHOTO.jpg',base).href);
 assert.equal(covers[0].credit,'Agencia');
 assert.equal(covers.length,1);
 assert.equal(extractArticle(html,base).external_image_url,covers[0].url);
 assert.equal(editorialPhoto('/assets/images/logos/fallback-promo-image-1200x630.png',base),false);
});
test('Infobae without an article photograph never restores a rejected OG fallback or related-story image', () => {
 const base='https://www.infobae.com/america/agencias/nota/';
 const html='<title>Nota sin fotografía</title><meta property="og:image" content="/assets/images/logos/fallback-promo-image-1200x630.png"><article><div class="body-article"><p>Contenido público de la noticia.</p></div><a class="feed-list-card"><img src="/related-in-article.jpg"></a></article><main><img src="/related-story.jpg"></main>';
 const article=extractArticle(html,base);
 assert.equal(article.external_image_url,'');
 assert.deepEqual(article.cover_candidates,[]);
 assert.equal(editorialPhoto('/assets/images/logos/fallback-promo-image-1200x630.png','https://other.example/'),true);
});
