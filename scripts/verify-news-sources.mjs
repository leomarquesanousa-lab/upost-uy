import {writeFile,mkdir} from 'node:fs/promises';
import {initialSources,sourceEntries,retrySource,canonicalArticle} from '../lib/editorial/source-sync.mjs';
import {fetchRemoteFeed,fetchRemotePage} from '../lib/security/remote-page.mjs';
import {extractArticle} from '../lib/editorial/import-article.mjs';
const results=[];
for(const source of initialSources){
 const result={name:source.name,url:source.url,feed:source.feed,checkedAt:new Date().toISOString()};
 try{
  const page=await retrySource(()=>source.feed?fetchRemoteFeed(source.feed):fetchRemotePage(source.url));
  const entries=sourceEntries(page.html,source.url,Boolean(source.feed));
  result.entries=entries.length;result.status=entries.length?'ok':'empty';result.sample=entries[0];
  if(entries[0])try{const articlePage=await retrySource(()=>fetchRemotePage(entries[0].url));await mkdir('test-results',{recursive:true});await writeFile('test-results/verified-article-'+source.category+'.html',articlePage.html);const article=extractArticle(articlePage.html,entries[0].url,articlePage.url);result.article={title:article.title,date:article.original_published_at,canonical:canonicalArticle(articlePage.html,articlePage.url,source.url),summaryAvailable:Boolean(article.excerpt),imageAvailable:Boolean(article.external_image_url),bodyCharacters:article.body.length};}catch(error){result.articleError=error.message;}
 }catch(error){result.status='error';result.error=error.message;}
 results.push(result);console.log(JSON.stringify(result));
}
await mkdir('test-results',{recursive:true});await writeFile('test-results/news-sources-verification.json',JSON.stringify(results,null,2));
