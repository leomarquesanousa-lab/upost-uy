import { test,expect,type BrowserContext } from '@playwright/test';
import { Pool } from 'pg';
import { randomUUID,randomBytes,createHash } from 'node:crypto';
if(process.env.BIOSFERA_E2E!=='1')throw new Error('Use npm run test:e2e.');
const pool=new Pool({connectionString:process.env.DATABASE_URL});
test.afterAll(()=>pool.end());
test.setTimeout(90000);
async function auth(context:BrowserContext,role='OWNER'){
 let user=(await pool.query('SELECT id FROM users WHERE role=$1 LIMIT 1',[role])).rows[0];
 if(!user){user={id:randomUUID()};await pool.query('INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',[user.id,'Equipe teste',`${role.toLowerCase()}@example.test`,'unused',role]);}
 const token=randomBytes(32).toString('hex');await pool.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[randomUUID(),user.id,createHash('sha256').update(token).digest('hex')]);
 await context.addCookies([{name:'__Host-biosfera_session',value:token,domain:'localhost',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}]);
}
test('EDITOR cadastra, relaciona, edita grade, impede conflito e publica exceções',async({page,context})=>{
 await auth(context,'EDITOR');
 await page.goto('/admin/apresentadores/novo');await page.getByLabel('Nome',{exact:true}).fill('Apresentadora Fase 3');await page.getByLabel('Biografia').fill('Biografia real de teste');await page.getByRole('button',{name:'Salvar',exact:true}).click();await expect(page).toHaveURL(/\/admin\/apresentadores$/);
 await page.goto('/admin/programas/novo');await page.getByLabel('Nome',{exact:true}).fill('Programa Fase 3');await page.getByLabel('Descrição curta',{exact:true}).fill('Descrição de teste');await page.getByLabel('Apresentadora Fase 3',{exact:true}).check();await page.getByRole('button',{name:'Salvar',exact:true}).click();await expect(page).toHaveURL(/\/admin\/programas$/);
 expect((await pool.query('SELECT count(*)::int AS n FROM program_presenters')).rows[0].n).toBe(1);
 await page.goto('/admin/programacao');await page.getByText('Adicionar horário',{exact:true}).click();const form=page.locator('details[open] form');await form.getByLabel('Programa',{exact:true}).selectOption({label:'Programa Fase 3'});await form.getByLabel('Início',{exact:true}).fill('08:00');await form.getByLabel('Término',{exact:true}).fill('12:00');await form.getByRole('button',{name:'Salvar',exact:true}).click();await expect(page.locator('summary').filter({hasText:'08:00'})).toHaveCount(1);
 await form.getByLabel('Programa',{exact:true}).selectOption({label:'Programa Fase 3'});await form.getByLabel('Início',{exact:true}).fill('09:00');await form.getByLabel('Término',{exact:true}).fill('11:00');await form.getByRole('button',{name:'Salvar',exact:true}).click();await expect(form.getByRole('status')).toContainText('Conflito');
 const program=(await pool.query("SELECT id FROM programs WHERE slug='programa-fase-3'")).rows[0];
 await expect(pool.query("INSERT INTO schedule_slots(id,weekday,program_id,start_time,end_time) VALUES($1,1,$2,'09:00','10:00')",[randomUUID(),program.id])).rejects.toMatchObject({code:'23P01'});
 await page.getByText('Adicionar programação especial',{exact:true}).click();const special=page.locator('details').filter({has:page.getByText('Adicionar programação especial',{exact:true})}).locator('form');await special.getByLabel('Data',{exact:true}).fill('2026-09-28');await special.getByLabel('Programa',{exact:true}).selectOption(program.id);await special.getByLabel('Início',{exact:true}).fill('09:00');await special.getByLabel('Término',{exact:true}).fill('10:00');await special.getByLabel('Título especial (opcional)').fill('Edição especial');await special.getByRole('button',{name:'Salvar',exact:true}).click();await expect(page.locator('summary').filter({hasText:'Edição especial'})).toBeVisible();
 await page.goto('/programas/programa-fase-3');await expect(page.getByRole('heading',{name:'Programa Fase 3'})).toBeVisible();await expect(page.getByRole('link',{name:'Apresentadora Fase 3',exact:true})).toBeVisible();await expect(page.getByText('Segunda · 08:00 – 12:00')).toBeVisible();
 await page.goto('/apresentadores/apresentadora-fase-3');await expect(page.getByText('Biografia real de teste')).toBeVisible();
 await pool.query('UPDATE programs SET active=false WHERE id=$1',[program.id]);await page.goto('/programas');await expect(page.getByRole('link',{name:'Programa Fase 3',exact:true})).toHaveCount(0);await pool.query('UPDATE programs SET active=true WHERE id=$1',[program.id]);
 const today=(await pool.query("SELECT to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') AS date")).rows[0].date;
 await pool.query('DELETE FROM schedule_exceptions WHERE date=$1',[today]);
 await pool.query("INSERT INTO schedule_exceptions(id,date,program_id,start_time,end_time,title) VALUES($1,$2,$3,'00:00','24:00','Ao vivo de teste')",[randomUUID(),today,program.id]);
 const current=await (await context.request.get('/api/programacao')).json();expect(current.current.title).toBe('Ao vivo de teste');
 await page.goto('/');await expect(page.locator('.now-playing')).toContainText('Ao vivo de teste');await expect(page.locator('.now-playing')).toContainText('Apresentadora Fase 3');
 for(const route of ['/','/programacao','/admin/programacao','/admin/programas','/admin/apresentadores','/admin/chat']){await page.goto(route);await page.screenshot({path:`test-results/phase3-${route.replaceAll('/','-')||'home'}.png`,fullPage:true});}
 await page.setViewportSize({width:390,height:844});await page.goto('/programacao');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/phase3-programacao-mobile.png',fullPage:true});
});
test('chat: sessão, limites, sanitização, resposta, moderação, bloqueio e desativação',async({page,context,browser})=>{
 await pool.query("UPDATE settings SET value='true' WHERE key='CHAT_ENABLED'");
 await page.goto('/');const chat=page.locator('.chat-panel');await chat.getByLabel('Seu nome',{exact:true}).fill('Ouvinte Fase 3');await chat.getByRole('button',{name:'Entrar no chat'}).click();await expect(chat.getByLabel('Sua mensagem')).toBeVisible();
 const cookie=(await context.cookies()).find(c=>c.name==='__Host-biosfera_chat');expect(cookie?.httpOnly&&cookie.secure).toBe(true);
 const post=(data:object)=>context.request.post('/api/chat',{headers:{origin:'http://localhost:3100'},data});
 expect((await post({intent:'send',message:' '})).status()).toBe(400);expect((await post({intent:'send',message:'x'.repeat(501)})).status()).toBe(400);
 await chat.getByLabel('Sua mensagem').fill('Mensagem do ouvinte');await chat.getByRole('button',{name:'Enviar',exact:true}).click();await expect(chat.getByText('Mensagem do ouvinte',{exact:true})).toBeVisible();
 expect((await post({intent:'send',message:'Spam'})).status()).toBe(400);
 await pool.query("DELETE FROM request_limits WHERE key LIKE 'chat:send:%'");expect((await post({intent:'send',message:'<b>Texto seguro</b><script>alert(1)</script>'})).ok()).toBe(true);
 const visitor=(await pool.query("SELECT id,token_hash FROM chat_visitors WHERE display_name='Ouvinte Fase 3'")).rows[0];expect(visitor.token_hash).not.toBe(cookie!.value);
 const admin=await browser.newContext();await auth(admin,'EDITOR');const ap=await admin.newPage();await ap.goto('/admin/chat');await expect(ap.getByText('Texto seguro',{exact:true})).toBeVisible();await ap.getByLabel('Resposta da Biosfera').fill('Resposta da equipe');await ap.getByRole('button',{name:'Enviar',exact:true}).click();await expect(chat.getByText('Resposta da equipe',{exact:true})).toBeVisible({timeout:12000});await expect(chat.getByText('BIOSFERA',{exact:true})).toBeVisible();
 const row=ap.locator('.chat-messages li').filter({has:ap.getByText('Mensagem do ouvinte',{exact:true})});await row.getByRole('button',{name:'Ocultar',exact:true}).click();await expect(chat.getByText('Mensagem do ouvinte',{exact:true})).toHaveCount(0,{timeout:12000});await row.getByRole('button',{name:'Bloquear sessão',exact:true}).click();expect((await post({intent:'send',message:'Bloqueado'})).status()).toBe(400);await row.getByRole('button',{name:'Desbloquear',exact:true}).click();
 await pool.query("DELETE FROM request_limits WHERE key LIKE 'chat:send:%'");expect((await post({intent:'send',message:'Desbloqueado'})).ok()).toBe(true);
 ap.once('dialog',dialog=>dialog.accept());await row.getByRole('button',{name:'Excluir',exact:true}).click();await expect(row.getByText('DELETED',{exact:true})).toBeVisible();
 await ap.getByRole('button',{name:'Desativar chat'}).click();expect((await post({intent:'send',message:'Desativado'})).status()).toBe(400);await expect(chat.getByText('Chat temporariamente indisponível.')).toBeVisible({timeout:12000});await ap.getByRole('button',{name:'Ativar chat'}).click();
 expect((await context.request.get('/api/chat?admin=1')).status()).toBe(401);expect((await context.request.post('/api/chat',{headers:{origin:'https://evil.invalid'},data:{intent:'join',name:'Nome'}})).status()).toBe(400);
 expect((await pool.query("SELECT count(*)::int AS n FROM audit_log WHERE entity='chat'")).rows[0].n).toBeGreaterThanOrEqual(5);
 await admin.close();
});
