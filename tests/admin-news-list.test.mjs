// Isolated rendering of the real page/components; no session, Neon or R2 is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {transpileModule,ModuleKind,ScriptTarget,JsxEmit} from 'typescript';
import {renderToStaticMarkup} from 'react-dom/server';
import {chromium} from '@playwright/test';
const react=new URL('../node_modules/react/index.js',import.meta.url).href;
const cssNames=['list','heading','filters','table','title','date','actions'];
const stub=code=>({url:'data:text/javascript,'+encodeURIComponent(code),shortCircuit:true});
registerHooks({resolve(s,c,next){
 if(s==='next/link')return stub(`import React from ${JSON.stringify(react)};export default function Link({children,...props}){return React.createElement('a',props,children)}`);
 if(s==='next/navigation')return stub('export function useRouter(){return {push(){},refresh(){}}}');
 if(s==='@/app/admin/news-lifecycle-actions')return stub('export async function lifecycleAction(){throw Error("No actions are executed in this isolated render") }');
 if(s==='@/server/repositories/editorial')return stub('export async function listNews(){return globalThis.newsListFixture} export async function taxonomyList(){return []} export function queryValue(v){return typeof v==="string"?v:""}');
 if(s.endsWith('news-list.module.css'))return stub('export default '+JSON.stringify(Object.fromEntries(cssNames.map(k=>[k,'news-list-'+k]))));
 if(s.startsWith('@/')||(s.startsWith('.')&&!c.parentURL?.includes('/node_modules/'))){const base=s.startsWith('@/')?new URL('../'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of['','.tsx','.ts','.mjs']){const u=new URL(base.href+ext);if(existsSync(u))return next(u.href,c);}}
 return next(s,c);
},load(url,c,next){
 if(url.endsWith('.tsx')&&!url.includes('/node_modules/'))return {format:'module',source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022,jsx:JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
 return next(url,c);
}});
test('admin news rows stay compact, desktop actions align and mobile has no page overflow',async()=>{
 globalThis.newsListFixture={items:Array.from({length:6},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),title:'Titular editorial de prueba con suficiente texto para comprobar el recorte y mantener las acciones alineadas',slug:'fixture-'+i,categories:[{name:'Uruguay'}],author_name:'Redacción',status:'PUBLISHED',published_at:new Date('2026-11-06T12:00:00Z'),scheduled_at:null,featured:false,updated_at:new Date('2026-11-06T13:00:00Z')})),count:6,page:1,pages:1};
 const Page=(await import('../app/admin/(protected)/noticias/page.tsx')).default;
 const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));
 assert.equal((html.match(/Enviar a Papelera/g)||[]).length,6);
 const control=readFileSync(new URL('../components/editorial/news-lifecycle-controls.tsx',import.meta.url),'utf8');assert.match(control,/confirm\(/);assert.match(control,/\['trash','purge','unprotect'\]/);
 let css=readFileSync(new URL('../app/admin/(protected)/noticias/news-list.module.css',import.meta.url),'utf8').replace(/:global\(([^)]+)\)/g,'$1');
 for(const name of cssNames)css=css.replace(new RegExp('\\.'+name+'(?![\\w-])','g'),'.news-list-'+name);
 const globalCss=['app/design-tokens.css','app/globals.css','app/visual-refresh.css','app/upost.css'].map(p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')).join('\n');
 const browser=await chromium.launch();
 try{const page=await browser.newPage();await page.setContent(`<style>${globalCss}\n${css}</style><main class="admin-main" style="max-width:1200px;margin:auto">${html}</main>`);
 await mkdir('test-results/admin-news-list',{recursive:true});
 for(const width of [1440,1024,390]){
  await page.setViewportSize({width,height:950});
  const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,rows:[...document.querySelectorAll('tbody tr')].map(row=>{const actions=[...row.querySelectorAll('.news-list-actions a,.news-list-actions button')].map(e=>e.getBoundingClientRect());return {height:row.getBoundingClientRect().height,aligned:Math.abs(actions[0].top-actions[1].top)<1};})}));
  assert.equal(metrics.overflow,false,JSON.stringify({width,...metrics}));
  assert.ok(metrics.rows.every(r=>r.aligned&&r.height<=(width>640?80:145)),JSON.stringify({width,...metrics}));
  await page.screenshot({path:`test-results/admin-news-list/${width}.png`,fullPage:true});
  console.log(JSON.stringify({width,maxRowHeight:Math.max(...metrics.rows.map(r=>r.height)),actionsAligned:true,noOverflow:true}));
 }
 await writeFile('test-results/admin-news-list/fixture.html',html);
 }finally{await browser.close();}
});
