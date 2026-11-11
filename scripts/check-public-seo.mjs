import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin='http://localhost:3105',results=[];
const browser=await chromium.launch();
try{
 const page=await browser.newPage();
 await page.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route(/googletagmanager|googlesyndication|google-analytics/,r=>r.abort());
 await page.goto(origin,{waitUntil:'networkidle'});
 const news=await page.locator('[data-news-id] h2 a').first().getAttribute('href');
 const video=await page.locator('[data-home-videos] [data-video-id] h2 a').first().getAttribute('href');
 for(const [kind,path,type]of [['news',news,'NewsArticle'],['video',video,'VideoObject']]){
  const response=await page.goto(origin+path,{waitUntil:'networkidle'});assert.equal(response.status(),200);
  assert.equal(await page.locator('title').count(),1);assert.equal(await page.locator('meta[name="description"]').count(),1);
  assert.equal(await page.locator('meta[property="og:title"]').count(),1);assert.equal(await page.locator('link[rel="canonical"]').count(),1);
  const title=await page.title(),description=await page.locator('meta[name="description"]').getAttribute('content');assert.ok(title&&description);
  assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'),title);
  assert.equal(await page.locator('meta[name="twitter:description"]').getAttribute('content'),description);
  const canonical=await page.locator('link[rel="canonical"]').getAttribute('href');if(kind==='video')assert.ok(canonical.endsWith(path));
  const blocks=await page.locator('script[type="application/ld+json"]').allTextContents();
  const data=blocks.flatMap(s=>[JSON.parse(s)].flat());assert.ok(data.some(d=>d['@type']===type));
  const image=await page.locator('meta[property="og:image"]').getAttribute('content');assert.ok(/^https?:\/\//.test(image||''));
  results.push({kind,path,title,description,canonical,structured:type,singleMetadata:true,image});
 }
 const missing=await page.goto(origin+'/videos?video=00000000-0000-4000-8000-000000000000',{waitUntil:'networkidle'});
 assert.ok(missing.status()===404||await page.locator('meta[name="robots"][content*="noindex"]').count()>0);
 const sitemap=await (await page.request.get(origin+'/sitemap.xml')).text();
 assert.ok(sitemap.includes('/noticias/')&&sitemap.includes('/videos?video='));assert.ok(!sitemap.includes('/admin/'));
 results.push({privateOrMissingVideoNotIndexed:true,newsAndVideosInSitemap:true});
 await mkdir('artifacts/seo',{recursive:true});await writeFile('artifacts/seo/public-validation.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
