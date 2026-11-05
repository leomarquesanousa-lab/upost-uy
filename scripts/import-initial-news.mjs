import './env.mjs';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { load } from 'cheerio';
import { fetchRemoteFeed, fetchRemotePage, ImportError } from '../lib/security/remote-page.mjs';
import { extractArticle } from '../lib/editorial/import-article.mjs';
import { databaseIdentity, normalizedSourceUrl, parseNewsFeed, summaryForm } from '../lib/editorial/initial-import.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const commit = process.argv.includes('--commit');
const manifestPath = path.join(root, 'scripts/initial-news.json');
let pool;
let lock;
const fail = message => { throw new Error('UPOST: ' + message); };

async function verifyArticles(articles) {
  const feeds = new Map();
  for (const url of new Set(articles.map(item => item.feedUrl))) {
    const feed = await fetchRemoteFeed(url);
    feeds.set(url, parseNewsFeed(feed.html));
  }
  return Promise.all(articles.map(async item => {
    const expected = normalizedSourceUrl(item.url);
    const entry = feeds.get(item.feedUrl).find(candidate =>
      candidate.title === item.title && new URL(candidate.url).hostname === new URL(expected).hostname);
    if (!entry) fail('Matéria não encontrada no feed oficial: ' + item.title);
    let page;
    try { page = await fetchRemotePage(entry.url); }
    catch (error) {
      if (!(error instanceof ImportError) || entry.url !== expected || entry.publishedAt !== item.publishedAt) throw error;
      // An official public RSS entry verifies title, URL and date even when its HTML endpoint blocks automation.
      return { item, title: entry.title, url: expected, publishedAt: entry.publishedAt, originalAuthor: '', verification: 'official-rss' };
    }
    const canonical = normalizedSourceUrl(page.url);
    if (canonical !== expected) fail('URL final diferente da matéria selecionada: ' + item.title);
    const article = extractArticle(page.html, canonical, canonical);
    if (article.title !== item.title) fail('Título original mudou: ' + item.title);
    let publishedAt = article.original_published_at;
    if (!publishedAt && item.visibleDate) {
      const visible = load(page.html).root().text().replace(/\s+/g, ' ');
      if (!visible.includes(item.visibleDate)) fail('Data não encontrada na página: ' + item.title);
      const match = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2})$/.exec(item.visibleDate);
      if (!match) fail('Data local inválida.');
      publishedAt = new Date(match[3] + '-' + match[2] + '-' + match[1] + 'T' + match[4] + ':00-03:00').toISOString();
    }
    publishedAt ||= entry.publishedAt;
    if (publishedAt !== item.publishedAt) fail('Data original diferente da seleção: ' + item.title);
    return { item, title: article.title, url: canonical, publishedAt, originalAuthor: article.original_author, verification: 'article-and-rss' };
  }));
}

// Resolve the same server-only editorial service used by the admin, in this trusted CLI process.
function installEditorialRuntime() {
  registerHooks({ resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: new URL('../node_modules/next/dist/compiled/server-only/empty.js', import.meta.url).href, shortCircuit: true };
    if (specifier.startsWith('@/') || (specifier.startsWith('.') && context.parentURL?.startsWith(new URL('../', import.meta.url).href) && !context.parentURL.includes('/node_modules/'))) {
      const base = specifier.startsWith('@/') ? new URL('../' + specifier.slice(2), import.meta.url) : new URL(specifier, context.parentURL);
      for (const suffix of ['', '.ts', '.mjs']) {
        const resolved = new URL(base.href + suffix);
        if (existsSync(resolved)) return next(resolved.href, context);
      }
    }
    return next(specifier, context);
  } });
}

async function main() {
  if (path.resolve(process.cwd()).toLowerCase() !== path.resolve(root).toLowerCase()) fail('Execute o script na raiz do UPOST.');
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (pkg.name !== 'upost-uy' || process.env.SITE_NAME !== 'UPOST.uy') fail('Identidade local do projeto não corresponde ao UPOST.');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const identity = databaseIdentity(process.env.DATABASE_URL || '');
  if (identity.fingerprint !== manifest.databaseFingerprint) fail('O Neon configurado difere do banco UPOST previamente verificado.');
  if (manifest.articles.length !== 5 || new Set(manifest.articles.map(item => normalizedSourceUrl(item.url))).size !== 5 ||
      new Set(manifest.articles.map(item => item.category.slug)).size !== 5) fail('A carga deve conter cinco URLs e cinco editorias distintas.');

  installEditorialRuntime();
  const { getPool } = await import('../lib/db/pool.ts');
  const { saveTaxonomy, saveNews } = await import('../server/services/editorial.ts');
  pool = getPool();
  const client = await pool.connect();
  let owner;
  try {
    await client.query('BEGIN READ ONLY');
    const database = (await client.query('SELECT current_database() AS name')).rows[0].name;
    if (database !== identity.database) fail('Banco conectado diferente do DATABASE_URL verificado.');
    const stored = (await client.query("SELECT value FROM settings WHERE key='SITE_NAME'")).rows[0]?.value;
    if (stored && stored !== 'UPOST.uy') fail('A identidade registrada no banco não é UPOST.uy.');
    owner = (await client.query("SELECT id FROM users WHERE role='OWNER' AND active AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1")).rows[0]?.id;
    if (!owner) fail('OWNER ativo não encontrado; nenhuma conta será criada.');
    const migrations = Number((await client.query('SELECT count(*) FROM schema_migrations')).rows[0].count);
    console.log(JSON.stringify({ mode: commit ? 'commit' : 'dry-run', target: 'UPOST.uy / Neon', ...identity, migrations }));
    await client.query('ROLLBACK');
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }

  const verified = await verifyArticles(manifest.articles);
  // Validate every complete input before any write, using the existing editorial validator.
  const { newsInput } = await import('../lib/editorial/validation.ts');
  for (const entry of verified) newsInput(summaryForm(entry.item, { ...entry, authorId: owner, categoryId: owner }));
  console.log(JSON.stringify({ verified: verified.map(entry => ({
    title: entry.title, source: entry.item.sourceName, url: entry.url, publishedAt: entry.publishedAt,
    category: entry.item.category.name, verification: entry.verification, images: 0,
  })) }));
  if (!commit) return;

  lock = await pool.connect();
  await lock.query('SELECT pg_advisory_lock(84201905)');
  async function taxonomy(kind, slug, name, description) {
    const table = kind === 'categories' ? 'categories' : 'authors';
    const row = (await pool.query('SELECT id,active FROM ' + table + ' WHERE slug=$1', [slug])).rows[0];
    if (row) { if (!row.active) fail('Registro editorial inativo: ' + slug); return row.id; }
    const form = new FormData();
    form.set('name', name); form.set('slug', slug); form.set('active', 'on');
    form.set(kind === 'categories' ? 'description' : 'bio', description);
    return saveTaxonomy(kind, form, owner);
  }
  const result = [];
  for (const entry of verified) {
    const old = (await pool.query('SELECT id,slug,status FROM news WHERE source_url=$1', [entry.url])).rows[0];
    if (old) { result.push({ action: 'skipped', id: old.id, slug: old.slug, status: old.status }); continue; }
    const authorId = await taxonomy('authors', 'redaccion-upost', 'Redacción UPOST.uy', 'Selección y síntesis de noticias, con atribución y enlaces a los medios de origen.');
    const categoryId = await taxonomy('categories', entry.item.category.slug, entry.item.category.name, 'Editoría de UPOST.uy.');
    const id = await saveNews(summaryForm(entry.item, { ...entry, authorId, categoryId }), owner);
    await pool.query('INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',
      [owner, 'news.initial_import', 'news', id, JSON.stringify({ summaryOnly: true, source_url: entry.url, verification: entry.verification, images: 0 })]);
    result.push({ action: 'created', id, title: entry.title });
  }
  const published = await pool.query(`SELECT n.id,n.title,n.slug,n.excerpt,n.source_name,n.source_url,n.published_at,n.cover_image,
    (SELECT json_agg(c.slug) FROM news_categories nc JOIN categories c ON c.id=nc.category_id WHERE nc.news_id=n.id) AS categories
    FROM public_news n WHERE n.source_url=ANY($1::text[]) ORDER BY n.published_at DESC,n.id`, [verified.map(entry => entry.url)]);
  if (published.rowCount !== 5) fail('A carga não produziu cinco matérias públicas; confira os registros informados.');
  console.log(JSON.stringify({ result, published: published.rows }));
}

try { await main(); }
catch (error) {
  console.error(error instanceof Error && (error.message.startsWith('UPOST:') || error instanceof ImportError) ? error.message : 'A importação falhou; nenhuma credencial foi exibida. Código: ' + (error.code || 'VALIDATION'));
  if (process.argv.includes('--debug')) console.error(JSON.stringify({ name: error.name, frames: error.stack?.split('\n').slice(1, 5) }));
  process.exitCode = 1;
} finally {
  if (lock) { await lock.query('SELECT pg_advisory_unlock(84201905)').catch(() => {}); lock.release(); }
  if (pool) await pool.end();
}
