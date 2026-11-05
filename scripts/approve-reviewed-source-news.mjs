// Controlled editorial approval of the three externally verified demonstration stories.
// Uses the same saveNews validation, media checks, version checks and audit as the editor.
import './env.mjs';
import {registerHooks}from'node:module';import{existsSync}from'node:fs';import{readFile,writeFile}from'node:fs/promises';
import{databaseIdentity}from'../lib/editorial/initial-import.mjs';
registerHooks({resolve(s,c,next){if(s==='server-only')return{url:new URL('../node_modules/next/dist/compiled/server-only/empty.js',import.meta.url).href,shortCircuit:true};if(s.startsWith('@/')||(s.startsWith('.')&&c.parentURL?.startsWith(new URL('../',import.meta.url).href)&&!c.parentURL.includes('/node_modules/'))){const base=s.startsWith('@/')?new URL('../'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of['','.ts','.mjs']){const u=new URL(base.href+ext);if(existsSync(u))return next(u.href,c);}}return next(s,c);}});
const guard=JSON.parse(await readFile('scripts/initial-news.json'));
if(process.env.SITE_NAME!=='UPOST.uy'||databaseIdentity(process.env.DATABASE_URL||'').fingerprint!==guard.databaseFingerprint)throw Error('Wrong database');
const reviews=JSON.parse(await readFile('test-results/reviewed-source-news.json'));
if(reviews.length!==3||new Set(reviews.map(n=>n.source_name)).size!==3)throw Error('Exactly three reviewed sources required');
const {getPool}=await import('../lib/db/pool.ts');const {saveNews}=await import('../server/services/editorial.ts');const pool=getPool();
try{
 const owner=(await pool.query("SELECT id FROM users WHERE role='OWNER' AND active AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1")).rows[0]?.id;if(!owner)throw Error('No active owner');
 const results=[];
 for(const reviewed of reviews){
  const old=(await pool.query('SELECT n.*,array(SELECT category_id FROM news_categories WHERE news_id=n.id) AS category_ids FROM news n WHERE id=$1',[reviewed.id])).rows[0];
  if(!old||old.source_url!==reviewed.source_url||old.cover_image!==reviewed.cover_image||!old.cover_image)throw Error('Reviewed story identity mismatch');
  if(old.status==='PUBLISHED'){results.push({id:old.id,slug:old.slug,alreadyPublished:true});continue;}
  if(old.status!=='DRAFT')throw Error('Only drafts may be approved');
  if(!process.argv.includes('--commit')){results.push({id:old.id,title:reviewed.title,status:old.status,readyForApproval:true});continue;}
  const data={...old,...reviewed,slug:old.slug,author_id:old.author_id,status:'PUBLISHED',published_at:new Date(old.published_at).toISOString(),scheduled_at:'',version:String(old.version)};
  const form=new FormData();
  for(const key of['id','version','title','slug','subtitle','excerpt','body','cover_image','cover_alt','cover_caption','cover_credit','author_id','status','published_at','scheduled_at','seo_title','seo_description','canonical_url','source_name','source_url'])form.set(key,String(data[key]||''));
  if(old.featured)form.set('featured','on');for(const category of old.category_ids)form.append('category_ids',category);
  await saveNews(form,owner);
  await pool.query("INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES($1,'source.editorial_review_approved','news',$2,$3)",[owner,old.id,JSON.stringify({reviewedAt:reviewed.reviewedAt,sourceUrl:old.source_url,summaryOnly:true,imageVerified:true})]);
  results.push({id:old.id,slug:old.slug,title:reviewed.title,source:old.source_name,url:old.source_url,image:old.cover_image,published:true});
 }
 await writeFile('test-results/source-editorial-approval.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await pool.end();}
