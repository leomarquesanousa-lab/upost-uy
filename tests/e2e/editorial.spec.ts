import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { Pool } from 'pg';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
if (process.env.BIOSFERA_E2E !== '1') throw new Error('Execute npm run test:e2e.');
const pool = new Pool({ connectionString:process.env.DATABASE_URL });
test.describe.configure({ mode:'serial' });
test.setTimeout(120000);
let categoryId = '';
let authorId = '';
let draftId = '';
let editorId = '';
test.afterEach(async () => { await pool.query('DELETE FROM sessions'); });
test.afterAll(async () => {
  if (editorId) await pool.query('DELETE FROM users WHERE id=$1',[editorId]);
  await pool.end();
});
async function authenticated(context: BrowserContext, userId?: string) {
  const id = userId || (await pool.query("SELECT id FROM users WHERE role='OWNER'")).rows[0].id;
  const token = randomBytes(32).toString('hex');
  await pool.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[randomUUID(),id,createHash('sha256').update(token).digest('hex')]);
  await context.addCookies([{ name:'__Host-biosfera_session',value:token,domain:'localhost',path:'/',httpOnly:true,secure:true,sameSite:'Lax' }]);
}
async function createNews(page: Page, title: string, status = 'DRAFT', schedule?: string) {
  await page.goto('/admin/noticias/nova');
  await page.getByLabel('Título *',{exact:true}).fill(title);
  await page.getByLabel('Resumo',{exact:true}).fill('Pesquisa ambiental e conservação na Biosfera.');
  await page.getByLabel('Conteúdo *',{exact:true}).fill('## Ciência e natureza\n\nUma reportagem sobre **biodiversidade**.\n\n<script>window.editorialAttack=true</script><img src="x" onerror="window.editorialAttack=true">');
  await page.getByLabel('Autor *',{exact:true}).selectOption(authorId);
  await page.getByLabel('Ciência',{exact:true}).check();
  await page.getByLabel('Status',{exact:true}).selectOption(status);
  if (schedule) await page.getByLabel('Agendamento (UTC)',{exact:true}).fill(schedule);
}
async function save(page: Page) {
  await page.getByRole('button',{name:'Salvar notícia',exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/noticias\?salvo=1$/);
}

test('categorias e autores: criar, duplicidade, editar, desativar e excluir sem vínculo',async ({page,context})=>{
  await authenticated(context);
  await page.goto('/admin/categorias/nova');
  await page.getByLabel('Nome *',{exact:true}).fill('Ciência');
  await page.getByLabel('Descrição',{exact:true}).fill('Ciência e meio ambiente');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/categorias\?salvo=1$/);
  categoryId = (await pool.query("SELECT id FROM categories WHERE slug='ciencia'")).rows[0].id;
  await page.goto('/admin/categorias/nova');
  await page.getByLabel('Nome *',{exact:true}).fill('Ciência');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page.locator('.form-error')).toContainText('slug já está em uso');
  await page.goto(`/admin/categorias/${categoryId}`);
  await page.getByLabel('Descrição',{exact:true}).fill('Categoria editorial de ciência');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/categorias\?salvo=1$/);
  await page.goto('/admin/autores/novo');
  await page.getByLabel('Nome *',{exact:true}).fill('Redação Biosfera');
  await page.getByLabel('Biografia',{exact:true}).fill('Equipe editorial de teste.');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/autores\?salvo=1$/);
  authorId = (await pool.query("SELECT id FROM authors WHERE slug='redacao-biosfera'")).rows[0].id;
  await page.goto('/admin/autores/novo');
  await page.getByLabel('Nome *',{exact:true}).fill('Autor temporário');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/autores\?salvo=1$/);
  const temporaryId = (await pool.query("SELECT id FROM authors WHERE slug='autor-temporario'")).rows[0].id;
  await page.goto(`/admin/autores/${temporaryId}`);
  await page.getByLabel('Ativo',{exact:true}).uncheck();
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/autores\?salvo=1$/);
  expect((await pool.query('SELECT active FROM authors WHERE id=$1',[temporaryId])).rows[0].active).toBe(false);
  await page.goto(`/admin/autores/${temporaryId}`);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Excluir',exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/autores\?salvo=1$/);
  expect((await pool.query('SELECT id FROM authors WHERE id=$1',[temporaryId])).rowCount).toBe(0);
});

test('rascunho, publicação, upload, home, busca, SEO, sitemap, arquivo e agendamento',async ({page,context,request})=>{
  await authenticated(context);
  await createNews(page,'Pesquisa Biosfera');
  const png = await sharp({create:{width:640,height:360,channels:3,background:'#447744'}}).png().toBuffer();
  await page.getByLabel('Enviar imagem de capa',{exact:true}).setInputFiles({name:'capa.png',mimeType:'image/png',buffer:png});
  await expect(page.locator('.upload-preview')).toBeVisible();
  await page.getByLabel('Texto alternativo *',{exact:true}).fill('Paisagem usada para teste editorial');
  await page.getByLabel('Crédito',{exact:true}).fill('Biosfera');
  await page.getByRole('button',{name:'Atualizar prévia',exact:true}).click();
  await expect(page.getByLabel('Prévia do conteúdo')).toContainText('Ciência e natureza');
  expect(await page.getByLabel('Prévia do conteúdo').locator('script').count()).toBe(0);
  await save(page);
  draftId = (await pool.query("SELECT id FROM news WHERE slug='pesquisa-biosfera'")).rows[0].id;
  expect((await request.get('/noticias/pesquisa-biosfera')).status()).toBe(404);
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/noticias/pesquisa-biosfera');
  await page.goto(`/admin/noticias/${draftId}`);
  await page.getByLabel('Status',{exact:true}).selectOption('PUBLISHED');
  await page.getByLabel('Destaque na home',{exact:true}).check();
  await page.getByLabel('Título SEO',{exact:true}).fill('Pesquisa ambiental | Biosfera');
  await page.getByLabel('Descrição SEO',{exact:true}).fill('Conheça a pesquisa ambiental da Biosfera.');
  await save(page);
  await page.goto('/noticias/pesquisa-biosfera');
  await expect(page.getByRole('heading',{name:'Pesquisa Biosfera',exact:true})).toBeVisible();
  await expect(page).toHaveTitle('Pesquisa ambiental | Biosfera');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content','Conheça a pesquisa ambiental da Biosfera.');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','http://localhost:3100/noticias/pesquisa-biosfera');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content','article');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content','summary_large_image');
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
  expect(ld[0]['@type']).toBe('NewsArticle'); expect(ld[1]['@type']).toBe('BreadcrumbList');
  expect(await page.evaluate(()=>Boolean((window as unknown as {editorialAttack?:boolean}).editorialAttack))).toBe(false);
  const image = page.getByRole('img',{name:'Paisagem usada para teste editorial'});
  await expect(image).toBeVisible();
  const media = await request.get((await image.getAttribute('src'))!);
  expect(media.headers()['content-type']).toBe('image/webp');
  expect(media.headers()['x-content-type-options']).toBe('nosniff');
  await page.goto('/'); await expect(page.getByRole('heading',{name:'Pesquisa Biosfera',exact:true}).first()).toBeVisible();
  await page.goto('/busca?q=ambiental'); await expect(page.getByRole('heading',{name:'Pesquisa Biosfera',exact:true})).toBeVisible();
  await page.goto('/noticias?category=ciencia'); await expect(page.getByRole('heading',{name:'Pesquisa Biosfera',exact:true})).toBeVisible();
  expect(await (await request.get('/sitemap.xml')).text()).toContain('/noticias/pesquisa-biosfera');
  await createNews(page,'Rascunho reservado'); await save(page);
  const future = new Date(Date.now()+86400000).toISOString().slice(0,16);
  await createNews(page,'Agenda Biosfera','SCHEDULED',future); await save(page);
  expect((await request.get('/noticias/agenda-biosfera')).status()).toBe(404);
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/noticias/agenda-biosfera');
  await pool.query("UPDATE news SET scheduled_at=now()-interval '1 minute' WHERE slug='agenda-biosfera'");
  await page.goto('/noticias/agenda-biosfera'); await expect(page.getByRole('heading',{name:'Agenda Biosfera',exact:true})).toBeVisible();
  expect(await (await request.get('/sitemap.xml')).text()).toContain('/noticias/agenda-biosfera');
  await page.goto(`/admin/noticias/${draftId}`);
  await page.getByLabel('Status',{exact:true}).selectOption('ARCHIVED'); await save(page);
  expect((await request.get('/noticias/pesquisa-biosfera')).status()).toBe(404);
  await page.goto('/busca?q=Pesquisa%20Biosfera'); await expect(page.getByRole('heading',{name:'Pesquisa Biosfera',exact:true})).toHaveCount(0);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).not.toContain('/noticias/pesquisa-biosfera'); expect(sitemap).not.toContain('/noticias/rascunho-reservado');
  const events = (await pool.query('SELECT action FROM audit_log WHERE entity_id=$1',[draftId])).rows.map(row=>row.action);
  for (const action of ['news.create','news.update','news.status','news.publish','news.featured','news.archive']) expect(events).toContain(action);
  await page.goto(`/admin/categorias/${categoryId}`);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Excluir',exact:true}).click();
  await expect(page.locator('.form-error')).toContainText('vinculado');
});

test('EDITOR publica notícias e administra categorias/autores conforme política da Fase 4',async ({page,context,request})=>{
  editorId = randomUUID();
  await pool.query("INSERT INTO users(id,name,email,password_hash,role) VALUES($1,'Editor de teste','editor@example.test','unused','ADMIN')",[editorId]);
  await authenticated(context,editorId);
  await page.goto('/admin/categorias/nova');
  await page.getByLabel('Nome *',{exact:true}).fill('Ação não autorizada');
  await pool.query("UPDATE users SET role='EDITOR' WHERE id=$1",[editorId]);
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/categorias\?salvo=1$/);
  expect((await pool.query("SELECT id FROM categories WHERE slug='acao-nao-autorizada'")).rowCount).toBe(1);
  await page.goto('/admin/autores/novo'); await expect(page.getByRole('heading',{name:'Criar autor'})).toBeVisible();
  await createNews(page,'Matéria do editor','PUBLISHED'); await save(page);
  await page.goto('/noticias/materia-do-editor'); await expect(page.getByRole('heading',{name:'Matéria do editor',exact:true})).toBeVisible();
  const admin = await request.get('/admin/login');
  expect(await admin.text()).toContain('noindex');
  const noAuth = await request.post('/api/editorial/upload',{headers:{'content-type':'image/png','x-file-name':'fake.png',origin:'http://localhost:3100'},data:Buffer.from('invalid')});
  expect(noAuth.status()).toBe(401);
  const badUpload = await page.request.post('/api/editorial/upload',{headers:{'content-type':'image/png','x-file-name':'fake.png',origin:'http://localhost:3100'},data:Buffer.from('<script>bad</script>')});
  expect(badUpload.status()).toBe(400);
  const csrf = await page.request.post('/api/editorial/upload',{headers:{origin:'https://evil.invalid'},data:'invalid'});
  expect(csrf.status()).toBe(403);
});

test('filtros, paginação e conflito de edição preservam a versão salva',async ({page,context})=>{
  await authenticated(context);
  await page.goto('/admin/noticias?status=DRAFT&category=ciencia&author=redacao-biosfera&q=reservado');
  await expect(page.getByRole('cell',{name:'Rascunho reservado',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'Agenda Biosfera',exact:true})).toHaveCount(0);
  const id = (await pool.query("SELECT id FROM news WHERE slug='rascunho-reservado'")).rows[0].id;
  await page.goto(`/admin/noticias/${id}`);
  await pool.query('UPDATE news SET version=version+1 WHERE id=$1',[id]);
  await page.getByLabel('Título *',{exact:true}).fill('Não pode sobrescrever');
  await page.getByRole('button',{name:'Salvar notícia',exact:true}).click();
  await expect(page.locator('.form-error')).toContainText('outra aba');
  expect((await pool.query('SELECT title FROM news WHERE id=$1',[id])).rows[0].title).toBe('Rascunho reservado');
  // Dados temporários mínimos para cruzar o limite de 12 por página.
  for (let i=0;i<12;i++) {
    const key = randomUUID();
    await pool.query("INSERT INTO news(id,title,slug,body,author_id,status,published_at) VALUES($1,$2,$3,'Texto de teste',$4,'PUBLISHED',now())",[key,`Paginação ${i}`,`paginacao-${i}`,authorId]);
    await pool.query('INSERT INTO news_categories(news_id,category_id) VALUES($1,$2)',[key,categoryId]);
  }
  await page.goto('/noticias'); await expect(page.getByRole('navigation',{name:'Paginação'})).toContainText('Página 1 de 2');
  await page.getByRole('link',{name:'Próxima →',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Paginação'})).toContainText('Página 2 de 2');
  await page.setViewportSize({width:390,height:844});
  await page.goto('/noticias/agenda-biosfera');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/editorial-mobile.png',fullPage:true});
});
