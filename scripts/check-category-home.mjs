import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const baseline=JSON.parse(await readFile('artifacts/editorial/original-comparison.json','utf8')).local;
const browser=await chromium.launch(),results=[];
try{
 const page=await browser.newPage();
 await page.context().addCookies([{name:'upost_cookie_consent',value:encodeURIComponent(JSON.stringify({analytics:false,advertising:false})),url:'http://localhost:3105'}]);
 await page.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route(/googletagmanager|googlesyndication|google-analytics/,r=>r.abort());
 await page.goto('http://localhost:3105/',{waitUntil:'networkidle',timeout:60000});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,40));}scrollTo(0,0);});
  await page.waitForFunction(()=>[...document.querySelectorAll('.upost-home img')].every(i=>i.complete));
  const metrics=await page.evaluate(()=>{
   const root=document.querySelector('.upost-home'),lead=root.querySelector('[aria-label="Noticias destacadas"]'),main=lead.querySelector('.featured-news'),media=main.querySelector('.news-card-media');
   const groups=[...root.querySelectorAll('[data-home-category]')].map(g=>({slug:g.dataset.homeCategory,count:g.querySelectorAll('[data-news-id]').length,member:[...g.querySelectorAll('[data-news-id]')].every(a=>[...a.querySelectorAll('.category-tags a')].some(l=>new URL(l.href).searchParams.get('category')===g.dataset.homeCategory)),times:[...g.querySelectorAll('time')].map(t=>Date.parse(t.dateTime))}));
   const urls=[...root.querySelectorAll('.news-card h2 a,[data-source-news] h3 a')].map(a=>a.getAttribute('href'));
   const videoCards=[...root.querySelectorAll('[data-home-videos] [data-video-id]')];
   const firstTop=videoCards[0]?.getBoundingClientRect().top;
   return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,groups,stories:urls.length,unique:new Set(urls).size,broken:[...root.querySelectorAll('img')].filter(i=>!i.naturalWidth).length,grid:getComputedStyle(lead).gridTemplateColumns,gap:getComputedStyle(lead).gap,mainRadius:getComputedStyle(main).borderRadius,mainWidth:main.getBoundingClientRect().width,headlineFont:getComputedStyle(main.querySelector('h2')).fontSize,imageRadius:getComputedStyle(media).borderRadius,videoCount:videoCards.length,videoFirstRow:videoCards.filter(a=>Math.abs(a.getBoundingClientRect().top-firstTop)<2).length,videoRatios:videoCards.map(a=>{const r=a.querySelector('a').getBoundingClientRect();return r.width/r.height;}),podcastSection:[...root.querySelectorAll('h2,h3')].some(h=>/^podcasts?$/i.test(h.textContent.trim()))};
  });
  assert.equal(metrics.overflow,false);assert.equal(metrics.broken,0);assert.equal(metrics.stories,metrics.unique);assert.equal(metrics.podcastSection,false);
  assert.deepEqual(metrics.groups.slice(0,3).map(g=>g.slug),['uruguay','mundo','deportes']);
  for(const g of metrics.groups){assert.ok(g.member);assert.deepEqual(g.times,[...g.times].sort((a,b)=>b-a));}
  assert.equal(metrics.videoCount,3);assert.equal(metrics.videoFirstRow,width===1440?3:2);assert.ok(metrics.videoRatios.every(r=>Math.abs(r-16/9)<.01));
  const old=baseline.find(m=>m.width===width);assert.equal(metrics.grid,old.grid);assert.equal(metrics.gap,old.gap);assert.equal(metrics.mainWidth,old.main.width);assert.equal(metrics.mainRadius,old.main.radius);assert.equal(metrics.headlineFont,old.headline.fontSize);assert.equal(metrics.imageRadius,old.image.radius);
  results.push(metrics);
  const videos=page.locator('[data-home-videos]');await videos.scrollIntoViewIfNeeded();
  await videos.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  await videos.screenshot({path:`artifacts/editorial/category-home-videos-${width}.png`});
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:`artifacts/editorial/category-home-${width}.png`,fullPage:true});
 }
 await page.locator('[data-home-videos] h2 a').first().click();await page.waitForURL(/\/videos\?video=/);assert.equal(await page.getByRole('button',{name:/Assistir/}).count(),1);
 results.push({videoLink:true,approvedLeadUnchanged:true});
 await writeFile('artifacts/editorial/category-home-validation.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
