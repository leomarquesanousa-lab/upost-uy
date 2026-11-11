import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch(),results={};
try{
 for(const [name,origin]of [['production','https://upost.uy'],['local','http://localhost:3105']]){
  const page=await browser.newPage();
  await page.context().addCookies([{name:'upost_cookie_consent',value:encodeURIComponent(JSON.stringify({analytics:false,advertising:false})),url:origin}]);
  await page.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:'null'}));
  await page.route(/googletagmanager|googlesyndication|google-analytics/,r=>r.abort());
  await page.goto(origin,{waitUntil:'networkidle',timeout:60000});
  results[name]=[];
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,40));}scrollTo(0,0);});
   await page.waitForFunction(()=>[...document.querySelectorAll('.upost-home img')].every(i=>i.complete));
   const metrics=await page.evaluate(()=>{
    const root=document.querySelector('.upost-home'),lead=root.querySelector('section[aria-label="Noticias destacadas"]');
    const card=lead.querySelector('.featured-news'),compact=lead.querySelector('article:not(.featured-news)'),media=card.querySelector('.news-card-media');
    const properties=el=>{const s=getComputedStyle(el);return {font:s.fontFamily,fontSize:s.fontSize,radius:s.borderRadius,width:el.getBoundingClientRect().width};};
    const urls=[...root.querySelectorAll('.news-card h2 a,[data-source-news] h3 a')].map(a=>a.getAttribute('href'));
    return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,leadCards:lead.querySelectorAll('article').length,total:urls.length,unique:new Set(urls).size,grid:getComputedStyle(lead).gridTemplateColumns,gap:getComputedStyle(lead).gap,main:properties(card),headline:properties(card.querySelector('h2')),image:properties(media),ratio:media.getBoundingClientRect().width/media.getBoundingClientRect().height,compact:properties(compact),compactImage:properties(compact.querySelector('.news-card-media')),broken:[...root.querySelectorAll('img')].filter(i=>!i.naturalWidth).length};
   });
   assert.equal(metrics.overflow,false);assert.equal(metrics.leadCards,7);assert.equal(metrics.broken,0);
   if(name==='local')assert.equal(metrics.total,metrics.unique,'No duplicate source/highlight stories');
   results[name].push(metrics);
   await page.screenshot({path:`artifacts/editorial/original-${name}-${width}.png`,fullPage:true});
  }
  if(name==='local'){
   const first=await page.locator('.news-grid .news-card h2 a').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
   await page.goto(origin+'/?page=2',{waitUntil:'networkidle'});
   const second=await page.locator('.news-grid .news-card h2 a').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
   assert.ok(second.length&&second.every(url=>!first.includes(url)));
   const href=await page.locator('.featured-news h2 a').getAttribute('href');const response=await page.goto(origin+href,{waitUntil:'networkidle'});assert.equal(response.status(),200);
   results.pagination={differentPageContent:true,articleLink:true};
  }
  await page.close();
 }
 for(let i=0;i<2;i++){
  const a=results.production[i],b=results.local[i];
  for(const key of ['grid','gap','main','headline','image','ratio','compact','compactImage'])assert.deepEqual(b[key],a[key],`Production parity: ${a.width} ${key}`);
  assert.ok(b.total>a.total);
 }
 await writeFile('artifacts/editorial/original-comparison.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
