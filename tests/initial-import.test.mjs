import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { databaseIdentity, normalizedSourceUrl, parseNewsFeed, summaryForm } from '../lib/editorial/initial-import.mjs';
import { fetchRemoteFeed, requestPage } from '../lib/security/remote-page.mjs';

test('initial import targets Neon, rejects inherited identities and pins the configured endpoint', () => {
  assert.throws(() => databaseIdentity('postgresql://user:dummy@localhost/database'));
  assert.throws(() => databaseIdentity('postgresql://user:dummy@example.neon.tech/biosfera'));
  const a = databaseIdentity('postgresql://user:dummy@upost-a.neon.tech/neondb');
  const b = databaseIdentity('postgresql://user:dummy@upost-b.neon.tech/neondb');
  assert.notEqual(a.fingerprint, b.fingerprint);
  assert.equal(a.database, 'neondb');
  assert.equal(JSON.stringify(a).includes('dummy'), false);
});
test('RSS parsing retains original titles, dates and public URLs and drops invalid entries', () => {
  const items = parseNewsFeed('<rss><channel><item><title>Uruguay &amp; ciencia</title><link>https://example.com/nota?utm_source=rss#inicio</link><pubDate>Tue, 03 Nov 2026 20:00:00 -0300</pubDate><description><![CDATA[<p>Descripción pública.</p>]]></description></item><item><title>Privado</title><link>http://127.0.0.1/private</link><pubDate>Tue, 03 Nov 2026 20:00:00 -0300</pubDate></item></channel></rss>');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Uruguay & ciencia');
  assert.equal(items[0].url, 'https://example.com/nota');
  assert.equal(items[0].publishedAt, '2026-11-03T23:00:00.000Z');
  assert.equal(items[0].description, 'Descripción pública.');
  assert.equal(normalizedSourceUrl('https://example.com/nota?section=2&fbclid=x'), 'https://example.com/nota?section=2');
});
test('demonstration input contains only the curated summary and source link, never full source text or photographs', () => {
  const item = { title: 'Una noticia real', summary: 'Síntesis breve y atribuida.', sourceName: 'Medio de origen', url: 'https://example.com/nota', publishedAt: '2026-11-03T23:00:00.000Z', body: 'TEXTO COMPLETO QUE NO DEBE COPIARSE', cover_image: 'https://example.com/photo.jpg' };
  const params = { authorId: 'author', categoryId: 'category', originalAuthor: 'Autora original' };
  const now = Date.parse('2026-11-04T04:00:00Z');
  const form = summaryForm(item, params, now);
  assert.equal(form.get('status'), 'PUBLISHED');
  assert.equal(form.get('source_url'), item.url);
  assert.equal(form.get('canonical_url'), item.url);
  assert.equal(form.get('excerpt'), item.summary);
  assert.equal(form.get('cover_image'), null);
  assert.match(form.get('body'), /Leé la información completa/);
  assert.doesNotMatch(form.get('body'), /TEXTO COMPLETO|photo\.jpg/);
  assert.throws(() => summaryForm({ ...item, publishedAt: '2026-11-05T00:00:00Z' }, params, now));
  assert.throws(() => summaryForm({ ...item, publishedAt: '2025-11-03T00:00:00Z' }, params, now));
});
test('RSS transport validates MIME and streaming size while preserving SSRF checks', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', req.url === '/bad' ? 'text/html' : 'application/rss+xml');
    res.end(req.url === '/large' ? 'x'.repeat(200) : '<rss/>');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const request = url => requestPage(new URL('http://example.com:' + server.address().port + url), { address: '127.0.0.1', family: 4 }, AbortSignal.timeout(2000), 100, false, true);
    assert.equal((await request('/')).html, '<rss/>');
    await assert.rejects(request('/bad'));
    await assert.rejects(request('/large'));
    await assert.rejects(fetchRemoteFeed('http://127.0.0.1/private'));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
