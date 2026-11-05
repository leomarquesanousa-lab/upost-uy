import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';

const stub = code => ({ url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true });
const remoteModule = new URL('../lib/security/remote-page.mjs', import.meta.url).href;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@/lib/auth/editorial') return stub('export async function requireMutation(){if(!globalThis.importTest.authorized)throw new Error("unauthorized");return {id:"editor-id"}}');
  if (specifier === '@/lib/db/pool') return stub('export function getPool(){return globalThis.importTest.pool}');
  if (specifier === '@/server/services/request-limit') return stub('export async function consumeLimit(){return globalThis.importTest.allowed}');
  if (specifier === '@/server/services/import-editorial-image') return stub('export async function importEditorialImage(url,id){globalThis.importTest.images.push({url,id});return "/media/00000000-0000-4000-8000-000000000001.webp"}');
  if (specifier === '@/lib/security/remote-page.mjs') return stub(`export {remoteUrl,ImportError,fetchRemoteFeed} from ${JSON.stringify(remoteModule)};export async function fetchRemotePage(url){globalThis.importTest.downloads.push(url);return globalThis.importTest.page}`);
  if (specifier.startsWith('@/') || (specifier.startsWith('.') && !context.parentURL?.includes('/node_modules/'))) {
    const base = specifier.startsWith('@/') ? new URL('../' + specifier.slice(2), import.meta.url) : new URL(specifier, context.parentURL);
    for (const suffix of ['', '.ts', '.mjs']) {
      const url = new URL(base.href + suffix);
      if (existsSync(url)) return next(url.href, context);
    }
  }
  return next(specifier, context);
} });
const { importArticle } = await import('../app/admin/import-action.ts');
function reset() {
  const state = {
    authorized: true, allowed: true, images: [], downloads: [], queries: [], duplicate: '',
    page: { url: 'https://partner.example/final', html: '<html><head><meta property="og:title" content="Artículo de un periodista"><meta property="og:image" content="/foto.jpg"></head><body><article><p class="subtitle">Subtítulo</p><p>Texto completo con <strong>formato</strong>.</p><p>Segundo párrafo.</p><img src="/foto.jpg"></article></body></html>' },
  };
  state.pool = { async query(sql, values) {
    state.queries.push(sql);
    assert.doesNotMatch(sql, /portal_resources/, 'Import must not depend on a source registry or migration 009');
    return { rows: [], rowCount: sql.startsWith('SELECT id FROM news') && state.duplicate === values[0] ? 1 : 0 };
  } };
  globalThis.importTest = state;
  return state;
}
test('authenticated editors import full content and photographs without a source registry or extra approval', async () => {
  const state = reset();
  const result = await importArticle('https://partner.example/original#section');
  assert.equal(result.error, undefined);
  assert.equal(result.article.title, 'Artículo de un periodista');
  assert.equal(result.article.subtitle, 'Subtítulo');
  assert.match(result.article.body, /Texto completo con \*\*formato\*\*/);
  assert.match(result.article.body, /Segundo párrafo/);
  assert.match(result.article.body, /!\[.*\]\(\/media\//);
  assert.equal(result.article.source_url, state.page.url);
  assert.equal(result.article.canonical_url, state.page.url);
  assert.equal(result.article.status, 'DRAFT');
  assert.equal(state.images.length, 1);
  assert.equal(state.images[0].id, 'editor-id');
  assert.deepEqual(state.downloads, ['https://partner.example/original']);
  assert.ok(state.queries.some(sql => sql.startsWith('INSERT INTO audit_log')));
  assert.ok(state.queries.every(sql => !/INSERT INTO news|UPDATE news/.test(sql)));
});
test('authentication, URL validation, rate limits and duplicate protection precede image downloads', async () => {
  let state = reset(); state.authorized = false;
  assert.ok((await importArticle('https://partner.example/nota')).error);
  assert.equal(state.downloads.length, 0);
  state = reset();
  assert.ok((await importArticle('http://127.0.0.1/private')).error);
  assert.equal(state.downloads.length, 0);
  state = reset(); state.allowed = false;
  assert.ok((await importArticle('https://partner.example/nota')).error);
  assert.equal(state.downloads.length, 0);
  state = reset(); state.duplicate = 'https://partner.example/nota';
  assert.match((await importArticle(state.duplicate)).error, /ya fue importada/);
  assert.equal(state.downloads.length, 0);
  state = reset(); state.duplicate = state.page.url;
  assert.match((await importArticle('https://partner.example/alias')).error, /ya fue importada/);
  assert.equal(state.images.length, 0);
});
