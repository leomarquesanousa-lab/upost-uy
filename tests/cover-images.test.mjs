import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverCoverImages, photoUrl } from '../lib/editorial/cover-images.mjs';
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
