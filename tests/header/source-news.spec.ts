import {test,expect} from '@playwright/test';
for(const width of [1440,1024,768,390]){
 test(`real photographed source stories at ${width}`,async({page,context},info)=>{
  await page.setViewportSize({width,height:1000});
  await context.addCookies([{name:'upost_cookie_consent',value:encodeURIComponent(JSON.stringify({analytics:false,advertising:false})),url:'http://localhost:3000'}]);
  await page.route('**/api/ads/impression',route=>route.fulfill({json:{ok:true}}));
  await page.goto('/');const section=page.locator('[data-source-news]');await expect(section).toBeVisible();await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole('heading',{name:'Noticias de nuestras fuentes',exact:true})).toBeVisible();
  const cards=section.locator('[data-source-story]');await expect(cards).toHaveCount(3);
  await expect(page.locator('.portal-directory a[href="/medios-asociados"]')).toHaveCount(0);
  expect(await cards.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-source-story')))).toEqual(['Infobae','Presidencia del Uruguay','Xataka']);
  await expect.poll(()=>cards.locator('img').evaluateAll(imgs=>imgs.every(img=>(img as HTMLImageElement).complete&&(img as HTMLImageElement).naturalWidth>0))).toBe(true);
  const positions=[];
  for(const card of await cards.all()){
   const img=card.locator('img');await expect(img).toHaveAttribute('src',/^\/media\/.*\.webp$/);await expect(img).toHaveCSS('object-fit','cover');
   const rect=(await img.boundingBox())!;expect(Math.abs(rect.width/rect.height-1.6)).toBeLessThan(.02);positions.push(rect);
   expect(await card.locator('h3 a').innerText()).not.toBe('');
   expect(await card.locator('time').getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
   const lines=await card.locator('h3 a').evaluate(node=>({height:node.getBoundingClientRect().height,line:Number.parseFloat(getComputedStyle(node).lineHeight)}));expect(lines.height).toBeLessThanOrEqual(lines.line*3+1);
   await expect(card.locator('a[target="_blank"]')).toHaveAttribute('href',/^https:\/\//);
  }
  if(width>1000)expect(new Set(positions.map(r=>Math.round(r.y))).size).toBe(1);
  if(width===390)expect(new Set(positions.map(r=>Math.round(r.y))).size).toBe(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await section.screenshot({path:info.outputPath(`sources-${width}.png`)});
  await page.screenshot({path:info.outputPath(`homepage-${width}.png`),fullPage:true});
 });
}
test('three published stories display their real photographs and belong to their configured categories',async({page})=>{
 await page.goto('/');const cards=page.locator('[data-source-story]');await expect(cards).toHaveCount(3);
 const stories=await cards.evaluateAll(nodes=>nodes.map(node=>({title:node.querySelector('h3')!.textContent!,href:node.querySelector('h3 a')!.getAttribute('href')!,image:node.querySelector('img')!.getAttribute('src')!})));
 for(const [i,story]of stories.entries()){
  const response=await page.goto(story.href);expect(response?.status()).toBe(200);await expect(page.getByRole('heading',{name:story.title,exact:true})).toBeVisible();
  await expect.poll(()=>page.locator('article figure img').evaluateAll(imgs=>imgs.some(img=>(img as HTMLImageElement).complete&&(img as HTMLImageElement).naturalWidth>0))).toBe(true);
  await page.goto('/noticias?category='+['mundo','uruguay','tecnologia'][i]);await expect(page.getByRole('link',{name:story.title,exact:true})).toBeVisible();
 }
});
