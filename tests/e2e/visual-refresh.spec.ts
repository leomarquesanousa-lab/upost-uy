import { test, expect } from '@playwright/test';
if (process.env.BIOSFERA_E2E !== '1') throw new Error('Use npm run test:e2e.');
test('identidade oficial, telas e responsividade', async ({ page }) => {
 test.setTimeout(90000);
 for (const width of [1440, 768, 390, 320]) {
  await page.setViewportSize({width,height:1000});
  await page.goto('/');
  const logo=page.locator('.header-brand img');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('alt','Biosfera Rádio TV Web');
  await expect.poll(()=>logo.evaluate((el)=> (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const box=await logo.boundingBox();expect(box!.width/box!.height).toBeCloseTo(1916/821,1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), String(width)).toBe(true);
  if(width<980){await page.getByRole('button',{name:'Abrir menu'}).click();await expect(page.locator('.main-nav')).toBeVisible();await page.getByRole('button',{name:'Fechar menu'}).click();}
  await page.screenshot({path:'test-results/visual-home-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const route of ['/noticias','/programacao','/programas','/apresentadores','/admin/login']) {
  await page.goto(route);await page.screenshot({path:'test-results/visual'+route.replaceAll('/','-')+'.png',fullPage:true});
 }
 await page.getByLabel('E-mail',{exact:true}).fill(process.env.ADMIN_INITIAL_OWNER_EMAIL!);
 await page.getByLabel('Senha',{exact:true}).fill(process.env.ADMIN_INITIAL_OWNER_PASSWORD!);
 await page.getByRole('button',{name:'Entrar no painel'}).click();await expect(page).toHaveURL(/\/admin$/);
 for(const route of ['/admin','/admin/minha-conta','/admin/chat','/admin/publicidade','/admin/noticias/nova']){
  await page.goto(route);await expect(page.locator('.admin-brand img')).toBeVisible();
  await page.screenshot({path:'test-results/visual'+route.replaceAll('/','-')+'.png',fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});await page.goto('/admin');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/visual-admin-mobile.png',fullPage:true});
});
