import {test,expect} from '@playwright/test';
for(const width of [1440,768,390]){
 test(`associated media directory and preserved homepage at ${width}`,async({page,context},testInfo)=>{
  await page.setViewportSize({width,height:1000});
  await context.addCookies([{name:'upost_cookie_consent',value:encodeURIComponent(JSON.stringify({analytics:false,advertising:false})),url:'http://localhost:3000'}]);
  await page.goto('/medios-asociados');
  await expect(page.getByRole('heading',{name:'Medios asociados y fuentes',exact:true})).toBeVisible();
  await expect(page.getByText('Las fuentes externas se identifican por su origen',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:testInfo.outputPath(`directory-${width}.png`),fullPage:true});
  await page.goto('/');
  await expect(page.getByRole('region',{name:'Banners destacados'})).toBeVisible();
  await expect(page.locator('[data-home-radio]')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 });
}
test('scheduler requires secret and administration still requires authentication',async({request,page})=>{
 const response=await request.get('/api/cron/sources');expect(response.status()).toBe(401);
 const post=await request.post('/api/cron/sources');expect(post.status()).toBe(401);
 await page.goto('/admin/red');await expect(page).toHaveURL(/\/admin\/login/);
});
