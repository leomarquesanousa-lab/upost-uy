import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch(),results=[];
await mkdir('artifacts/editorial',{recursive:true});
try{
 const page=await browser.newPage();
 await page.context().addCookies([{name:'upost_cookie_consent',value:encodeURIComponent(JSON.stringify({analytics:false,advertising:false})),url:'http://localhost:3105'}]);
 await page.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route(/googletagmanager|googlesyndication|google-analytics/,r=>r.abort());
 await page.goto('http://localhost:3105/videos',{waitUntil:'networkidle'});
 const cards=page.locator('[data-video-id]'),count=await cards.count();
 results.push({publishedVideos:count});
 for(const width of [360,390,430,768,1024,1440]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  if(count>1){const a=await cards.nth(0).boundingBox(),b=await cards.nth(1).boundingBox();assert.ok(Math.abs(a.y-b.y)<2);}
  if(count>3&&width===1440){const a=await cards.nth(0).boundingBox(),b=await cards.nth(3).boundingBox();assert.ok(Math.abs(a.y-b.y)<2);}
  await page.screenshot({path:`artifacts/editorial/videos-${width}.png`,fullPage:true});
 }
 if(count){
  await cards.first().locator('h2 a').click();await page.waitForURL(/video=/);
  assert.equal(await page.getByRole('button',{name:/Assistir/}).count(),1);
  for(const width of [390,768,1024,1440]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
   const related=await page.getByRole('complementary',{name:'Videos relacionados'}).boundingBox();
   if(width>=1024)assert.ok(related.width>=240&&related.width<=280);
   else {const player=await page.getByRole('button',{name:/Assistir/}).boundingBox();assert.ok(related.y>player.y+player.height);}
   await page.screenshot({path:`artifacts/editorial/video-selected-${width}.png`,fullPage:true});
   results.push({width,relatedWidth:related.width,noOverflow:true});
  }
 }
 console.log(JSON.stringify(results,null,2));await writeFile('artifacts/editorial/videos-validation.json',JSON.stringify(results,null,2));
}finally{await browser.close();}
