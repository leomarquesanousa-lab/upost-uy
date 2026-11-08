import test from 'node:test';
import assert from 'node:assert/strict';
import {mediosPublicosSource as source,sourceFeedUrls,interleaveSourceEntries,mediosPublicosPhoto} from '../lib/editorial/medios-publicos.mjs';
import {sourceCategory,sourceEntries,sourceSummary,initialSources,automaticSources} from '../lib/editorial/source-sync.mjs';
import {extractArticle} from '../lib/editorial/import-article.mjs';
import http from 'node:http';
import {once} from 'node:events';
import {gzipSync} from 'node:zlib';
import {requestPage} from '../lib/security/remote-page.mjs';
test('Medios Públicos maps only its news desks and preserves all existing source categories',()=>{
 for(const [tag,slug]of [['Nacionales','uruguay'],['Internacionales','mundo'],['Cultura','cultura'],['Deportes','deportes']])assert.equal(sourceCategory({url:source.url},{tags:'Noticias '+tag}),slug);
 assert.equal(sourceCategory({url:source.url},{tags:'Programas Cultura'}),'');
 assert.equal(sourceCategory({url:source.url},{tags:'Noticias Nacionales Cultura'}),'cultura');
 assert.equal(sourceCategory({url:'https://www.infobae.com/',category_slug:'mundo'},{tags:'Noticias Cultura'}),'mundo');
 assert.equal(initialSources.length,3);assert.equal(automaticSources.length,4);
});
test('one source uses four official feeds, interleaves desks, deduplicates and respects custom feed settings',()=>{
 assert.equal(sourceFeedUrls({url:source.url,feed_url:source.feed}).length,4);
 assert.deepEqual(sourceFeedUrls({url:source.url,feed_url:'https://mediospublicos.uy/custom/feed/'}),['https://mediospublicos.uy/custom/feed/']);
 assert.deepEqual(sourceFeedUrls({url:source.url,feed_url:''}),[]);
 const groups=[[{url:'a'},{url:'b'}],[{url:'c'},{url:'a'}],[{url:'d'}],[{url:'e'}]];
 assert.deepEqual(interleaveSourceEntries(groups).map(e=>e.url),['a','c','d','e','b']);
});
test('Medios Públicos uses the article thumbnail, excludes branding/related stories and retains credits',()=>{
 const html='<title>Nota verificable</title><meta property="og:image" content="/logo.png"><header><img src="/banner.jpg"></header><div class="thumb"><figure><img src="/wp-content/uploads/2026/11/nota.jpg" alt="La noticia"><figcaption>La noticia · Foto: Agencia</figcaption></figure></div><div class="yarpp-related"><img src="/related.jpg"></div><p>Contenido público.</p>';
 const article=extractArticle(html,source.url+'nota/');assert.equal(article.cover_candidates.length,1);assert.match(article.external_image_url,/nota\.jpg$/);assert.equal(article.cover_credit,'Agencia');
 for(const value of ['https://mediospublicos.uy/logo.png','https://mediospublicos.uy/banner.jpg','https://mediospublicos.uy/favicon.ico'])assert.equal(mediosPublicosPhoto(value),false);
 assert.equal(extractArticle('<meta property="og:image" content="/logo.png"><p>Sin fotografía.</p>',source.url+'nota/').external_image_url,'');
});
test('official RSS desk tags, dates, identifiers and original URLs remain available to existing deduplication',()=>{
 const xml='<rss><channel><item><guid>123</guid><title>Noticia verificable</title><link>https://mediospublicos.uy/nota/</link><pubDate>Sun, 08 Nov 2026 12:00:00 GMT</pubDate><description>Resumen público de la fuente.</description><category>Noticias</category><category>Deportes</category></item></channel></rss>';
 const [entry]=sourceEntries(xml,source.url);assert.equal(entry.id,'123');assert.equal(sourceCategory(source,entry),'deportes');assert.equal(entry.url,'https://mediospublicos.uy/nota/');assert.ok(Number.isFinite(Date.parse(entry.date)));
});
test('Medios Públicos summaries use article paragraphs, never site navigation or reading-time text',()=>{
 const html='<div><h1>Noticia verificable</h1><h3>Subtítulo de la noticia</h3></div><div>Portal Medios Públicos . Noticias .</div><p>08.11.2026 | tiempo de lectura: 2 minutos</p><div class="single-cont"><p>El artículo informa sobre una actividad cultural abierta a todo el público.</p><p>La programación incluye varias propuestas para el fin de semana.</p></div>';
 const article=extractArticle(html,source.url+'nota/'),summary=sourceSummary(article,{summary:'Resumen sin punto final'});
 assert.equal(article.subtitle,'Subtítulo de la noticia');assert.equal(summary.complete,true);assert.match(summary.text,/actividad cultural/);assert.doesNotMatch(summary.text,/Portal Medios|tiempo de lectura/);
});
test('opt-in gzip is bounded and the default transport still rejects compression',async()=>{
 const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'application/rss+xml','content-encoding':'gzip'});res.end(gzipSync(req.url==='/large'?'x'.repeat(4096):'<rss><channel/></rss>'));});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const url=new URL('http://127.0.0.1:'+server.address().port+'/feed'),address={address:'127.0.0.1',family:4};
 try{const accepted=await requestPage(url,address,AbortSignal.timeout(3000),1024,false,true,true);assert.match(accepted.html,/<rss>/);await assert.rejects(requestPage(url,address,AbortSignal.timeout(3000),1024,false,true));url.pathname='/large';await assert.rejects(requestPage(url,address,AbortSignal.timeout(3000),1024,false,true,true),/grande/);}
 finally{await new Promise(resolve=>server.close(resolve));}
});
