import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const origin='http://localhost:3105';
const browser=await chromium.launch();
await mkdir('artifacts/editorial',{recursive:true});
const results=[];
try {
 const context=await browser.newContext();
 await context.addCookies([{name:'upost_cookie_consent',value:encodeURIComponent(JSON.stringify({analytics:false,advertising:false})),url:origin}]);
 // Never record ad delivery, analytics or other browser API writes.
 await context.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await context.route(/googletagmanager|googlesyndication|google-analytics/,r=>r.abort());
 const page=await context.newPage();
 await page.goto(origin,{waitUntil:'networkidle',timeout:60000});
 assert.equal(await page.title(),'UPOST.uy | Periodistas en Red');
 const homeVideos=page.locator('[data-home-videos]');
 const videoCount=await homeVideos.locator('[data-video-id]').count();
 assert.ok(videoCount>0&&videoCount<=3,'Published videos must appear on the real homepage');
 assert.equal(await page.locator('.upost-home video,.upost-home iframe').count(),0,'No player or autoplay on the homepage');
 assert.equal(await page.locator('.upost-home .portal-directory').count(),0);
 for(const width of [360,390,430,768,1024,1440]) {
  await page.setViewportSize({width,height:1000});
  // Exercise lazy images before taking a full-page capture.
  await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,50));}scrollTo(0,0);});
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-news-id] img')].every(i=>i.complete),{timeout:15000});
  const metrics=await page.evaluate(()=>{
   const stories=[...document.querySelectorAll('[data-news-id]')];
   return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,stories:stories.length,unique:new Set(stories.map(e=>e.dataset.newsId)).size,brokenImages:stories.flatMap(e=>[...e.querySelectorAll('img')]).filter(i=>!i.naturalWidth).length,columns:getComputedStyle(document.querySelector('[aria-label="Noticias destacadas"]')).gridTemplateColumns,tall:stories.filter(e=>e.getBoundingClientRect().height>700).map(e=>({title:e.querySelector('h2').textContent,children:[...e.children].map(c=>({cls:c.className,width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height,flex:getComputedStyle(c).flex}))}))};
  });
  assert.equal(metrics.scrollWidth,width);assert.equal(metrics.stories,metrics.unique);assert.ok(metrics.stories<=24);assert.equal(metrics.brokenImages,0);assert.deepEqual(metrics.tall,[],'Unexpected tall story or compressed title');
  results.push(metrics);
  await page.screenshot({path:`artifacts/editorial/home-${width}.png`,fullPage:true});
  if(width===390||width===1440){
   await homeVideos.scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>[...document.querySelectorAll('[data-home-videos] img')].every(i=>i.complete&&i.naturalWidth>0));
   const layout=await homeVideos.evaluate(el=>{
    const cards=[...el.querySelectorAll('[data-video-id]')];const boxes=cards.map(c=>c.getBoundingClientRect());
    return {cards:cards.length,firstRow:boxes.filter(b=>Math.abs(b.y-boxes[0].y)<2).length,ratios:cards.map(c=>{const r=c.querySelector('a').getBoundingClientRect();return r.width/r.height;}),titleLines:cards.map(c=>getComputedStyle(c.querySelector('h2')).webkitLineClamp)};
   });
   assert.equal(layout.firstRow,Math.min(videoCount,width===1440?3:2));assert.ok(layout.ratios.every(r=>Math.abs(r-16/9)<.02));assert.ok(layout.titleLines.every(n=>n==='2'));
   results.push({width,homeVideos:layout});
   await homeVideos.screenshot({path:`artifacts/editorial/home-videos-${width}.png`});
  }
 }
 const link=homeVideos.locator('[data-video-id] h2 a').first();const destination=await link.getAttribute('href');
 await link.click();await page.waitForURL(origin+destination);
 assert.equal(await page.getByRole('button',{name:/Assistir/}).count(),1);
 await page.goto(origin+'/videos',{waitUntil:'networkidle'});assert.ok(await page.locator('[data-video-id]').count()>=videoCount);
 results.push({videoLinks:true,galleryLink:true,noAutoplayOnHome:true});
 await page.goto(origin+'/noticias',{waitUntil:'networkidle'});
 const options=await page.locator('select[name="author"] option').evaluateAll(es=>es.map(e=>({value:e.value,label:e.textContent})));
 assert.ok(options.length>1);
 await page.locator('select[name="author"]').selectOption(options[1].value);
 await page.getByRole('button',{name:'Buscar',exact:true}).click();
 await page.waitForURL(/author=/);
 assert.equal(await page.locator('select[name="author"]').inputValue(),options[1].value);
 results.push({journalistFilter:true,selected:options[1].label});
 console.log(JSON.stringify(results,null,2));
 await writeFile('artifacts/editorial/validation.json',JSON.stringify(results,null,2));
} finally {await browser.close();}
