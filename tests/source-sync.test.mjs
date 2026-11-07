import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceEntries,sourceUrl,canonicalArticle,eligibleEntry,automationInput,retrySource,sourceSummary,articlePhotographs} from '../lib/editorial/source-sync.mjs';
import {extractArticle} from '../lib/editorial/import-article.mjs';
test('Presidencia original calendar publication date is preserved in Montevideo timezone',()=>{
 const article=extractArticle('<meta property="og:title" content="Comunicado oficial"><div class="Page-date"> 05/11/2026 </div><article><p>Información oficial.</p></article>','https://www.gub.uy/presidencia/noticia');
 assert.equal(article.original_published_at,'2026-11-05T03:00:00.000Z');
 assert.equal(extractArticle('<div class="Page-date">31/02/2026</div>','https://www.gub.uy/presidencia/noticia').original_published_at,'');
});
test('summary uses a complete public sentence instead of a cut-off metadata description',()=>{
 const complete='La información oficial describe los acuerdos y las medidas anunciadas durante la reunión regional.';
 assert.deepEqual(sourceSummary({excerpt:'La información oficial describe los acuerdos y las medidas anunciadas durante la',body:'# Título\n\n'+complete}),{text:complete,complete:true});
 assert.equal(sourceSummary({excerpt:'Una descripción incompleta que finaliza antes de poder explicar la información'}).complete,false);
});
test('institutional building fallback is not used for an unrelated government story',()=>{
 const a={title:'Información sobre un científico',cover_candidates:[{url:'https://www.gub.uy/building.jpg',alt:'Torre Ejecutiva'}]};
 assert.equal(articlePhotographs(a,'https://www.gub.uy/presidencia').length,0);
 assert.equal(articlePhotographs({...a,title:'Obras en la Torre Ejecutiva'},'https://www.gub.uy/presidencia').length,1);
});
test('RSS and Atom: identifiers, dates, summaries, categories and images; foreign/private links rejected',()=>{
 const entries=sourceEntries('<rss><channel><item><guid>abc</guid><title>Uruguay y ciencia</title><link>https://example.com/a?utm_source=rss</link><pubDate>Thu, 05 Nov 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Resumen fiel.</p>]]></description><category>Ciencia</category><enclosure type="image/jpeg" url="https://example.com/a.jpg"/></item><item><title>Privado</title><link>http://127.0.0.1/a</link></item></channel></rss>','https://example.com/');
 assert.equal(entries.length,1);assert.equal(entries[0].id,'abc');assert.equal(entries[0].url,'https://example.com/a');assert.equal(entries[0].summary,'Resumen fiel.');assert.equal(entries[0].image,'https://example.com/a.jpg');
 assert.equal(sourceEntries('<feed><entry><title>Innovación</title><id>urn:1</id><link rel="alternate" href="https://example.com/b"/><updated>2026-11-05T10:00:00Z</updated></entry></feed>','https://example.com/')[0].url,'https://example.com/b');
 assert.throws(()=>sourceEntries('<html>Access denied</html>','https://example.com/'));
});
test('source without RSS discovers only public article headings and deduplicates listing URLs',()=>{
 const entries=sourceEntries('<main><h3><a href="/noticias/uno">Noticia uno</a></h3><h2><a href="/noticias/uno">Repetida</a></h2><h3><a href="https://other.com/a">Otro dominio</a></h3></main>','https://example.com/noticias',false);
 assert.equal(entries.length,1);assert.equal(entries[0].url,'https://example.com/noticias/uno');
});
test('canonical URL strips trackers, rejects foreign canonical; date and topic eligibility',()=>{
 assert.equal(canonicalArticle('<link rel="canonical" href="/a?utm_medium=rss#top">','https://example.com/amp/a','https://example.com/'),'https://example.com/a');
 assert.throws(()=>sourceUrl('https://evil.com/a','https://example.com/'));
 assert.throws(()=>canonicalArticle('<link rel="canonical" href="http://localhost/a">','https://example.com/a','https://example.com/'));
 const now=Date.parse('2026-11-05T12:00:00Z'),entry={title:'Innovación en Uruguay',summary:'',tags:'',date:'2026-11-05T10:00:00Z'};
 assert.equal(eligibleEntry(entry,'Uruguay,Argentina',now),true);assert.equal(eligibleEntry(entry,'deportes',now),false);assert.equal(eligibleEntry({...entry,date:'2026-12-01'},'',now),false);
});
test('automation modes validated on backend; no dates, license or link confirmations required',()=>{
 const f=new FormData();assert.deepEqual(automationInput(f),{enabled:false,interval_minutes:60,daily_limit:5,max_items:3,publication_mode:'review',content_mode:'summary',keywords:''});
 f.set('publication_mode','automatic');f.set('content_mode','full');f.set('automation_enabled','on');assert.equal(automationInput(f).enabled,true);
 f.set('max_items','10000');assert.throws(()=>automationInput(f));
});
test('unavailable source retries once only; technical access denials are never bypassed',async()=>{
 let calls=0;assert.equal(await retrySource(async()=>{if(++calls===1)throw Error('Timeout');return 'ok';},async()=>{}),'ok');assert.equal(calls,2);
 calls=0;await assert.rejects(retrySource(async()=>{calls++;throw Error('La fuente no permitió acceder a la página.');},async()=>{}));assert.equal(calls,1);
 calls=0;await assert.rejects(retrySource(async()=>{calls++;throw Error('Timeout');},async()=>{}));assert.equal(calls,2);
});
