import {load} from 'cheerio';
import {normalizedSourceUrl} from './initial-import.mjs';
import {plainText} from './content.mjs';
const clean = (value,max=600) => String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
export function feedSummary(html){
 const $=load(String(html||''));const first=$('p').filter((_,node)=>$(node).text().trim().length>40).first().text();
 const text=clean(first||$.text(),10000);
 if(text.length<=600)return text;
 const excerpt=text.slice(0,597),sentence=excerpt.search(/[.!?][^.!?]*$/);
 return sentence>100?excerpt.slice(0,sentence+1):excerpt.slice(0,excerpt.lastIndexOf(' '))+'…';
}
export function sourceSummary(article,entry={}){
 const paragraphs=String(article.body||'').split(/\n\s*\n/).filter(p=>!/^\s*[#!]/.test(p)&&!p.includes('UPOST_IMAGE')).map(p=>plainText(p));
 const candidates=[article.excerpt,entry.summary,...paragraphs].map(t=>clean(t,10000)).filter(t=>t.length>=20);
 for(const text of candidates){
  const limit=text.slice(0,600),ends=[...limit.matchAll(/[.!?](?:[”»"']?)(?=\s|$)/g)];
  const end=ends.at(-1);if(end&&end.index>=15&&!/\.{2,}$/.test(limit.slice(0,end.index+end[0].length)))return {text:limit.slice(0,end.index+end[0].length),complete:true};
 }
 return {text:feedSummary(candidates[0]||''),complete:false};
}
export function articlePhotographs(article,home){
 const government=/(^|\.)gub\.uy$/.test(new URL(home).hostname);
 const buildingStory=/torre ejecutiva/i.test(article.title||'');
 return (article.cover_candidates||[]).filter(photo=>!(government&&!buildingStory&&/^torre ejecutiva$/i.test(String(photo.alt||'').trim())));
}
export function sourceUrl(value,base) {
 const url=normalizedSourceUrl(new URL(value,base).href), home=new URL(base);
 if(new URL(url).hostname.replace(/^www\./,'')!==home.hostname.replace(/^www\./,''))throw Error('El artículo pertenece a otro dominio.');
 return url;
}
export function sourceEntries(content,base,feed=true) {
 const $=load(content,feed?{xmlMode:true}:undefined);
 if(feed){
  if(!$('rss,feed,RDF,rdf\\:RDF').length)throw Error('La respuesta no es un RSS o Atom válido.');
  return $('item,entry').slice(0,150).toArray().flatMap(node=>{
   const e=$(node),link=e.find('link').filter((_,n)=>!$(n).attr('rel')||$(n).attr('rel')==='alternate').first();
   try { const url=sourceUrl(link.attr('href')||link.text(),base); return [{title:clean(e.find('title').first().text(),240),url,id:clean(e.find('guid,id').first().text(),2048)||url,date:clean(e.find('pubDate,published,updated,dc\\:date').first().text(),80),summary:feedSummary(e.find('description,summary').first().text()),credit:clean(e.find('media\\:credit').first().text(),200),image:e.find('enclosure,media\\:content,media\\:thumbnail').filter((_,n)=>/^image\//.test($(n).attr('type')||'')||/media:/.test(n.tagName)).first().attr('url')||'',tags:e.find('category').map((_,n)=>$(n).text()||$(n).attr('term')).get().join(' ')}]; }catch{return [];}
  });
 }
 // Public news listings only: no pagination crawl or access-protection workarounds.
 return [...new Map($('main h2 a,main h3 a,.views-row h2 a,.views-row h3 a').toArray().flatMap(node=>{
  try{const url=sourceUrl($(node).attr('href'),base);if(url===normalizedSourceUrl(base))return [];return [[url,{url,id:url,title:clean($(node).text(),240),date:'',summary:'',image:'',credit:'',tags:''}]];}catch{return [];}
 })).values()].slice(0,30);
}
export function canonicalArticle(html,resolved,home) {
 const $=load(html);const canonical=$('link[rel="canonical"]').first().attr('href');
 return sourceUrl(canonical||resolved,home);
}
export function eligibleEntry(entry,keywords,now=Date.now()) {
 const date=Date.parse(entry.date);
 if(Number.isFinite(date)&&(date>now||now-date>7*86400000))return false;
 const words=String(keywords||'').split(',').map(v=>v.trim().toLocaleLowerCase('es')).filter(Boolean);
 const text=(entry.title+' '+entry.summary+' '+entry.tags).toLocaleLowerCase('es');
 return !words.length||words.some(word=>word.length>3?text.includes(word):text.split(/[^\p{L}\p{N}]+/u).includes(word));
}
export function automationInput(form) {
 const integer=(name,min,max,fallback)=>{const value=Number(form.get(name)||fallback);if(!Number.isInteger(value)||value<min||value>max)throw Error('Frecuencia o cantidad inválida.');return value;};
 const publication_mode=String(form.get('publication_mode')||'review'),content_mode=String(form.get('content_mode')||'summary');
 if(!['review','automatic'].includes(publication_mode)||!['summary','full'].includes(content_mode))throw Error('Modalidad inválida.');
 return {enabled:form.get('automation_enabled')==='on',interval_minutes:integer('interval_minutes',60,1440,60),daily_limit:integer('daily_limit',1,10000,5),max_items:integer('max_items',1,10,3),publication_mode,content_mode,keywords:String(form.get('keywords')||'').slice(0,1000)};
}
export async function retrySource(operation,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))) {
 try{return await operation();}catch(error){if(/bloquead|permitió|interna|reservada|formato|compatible|RSS/i.test(error.message))throw error;await pause(750);return operation();}
}
export const initialSources=[
 {name:'Infobae',url:'https://www.infobae.com/',feed:'https://www.infobae.com/arc/outboundfeeds/rss/',category:'mundo',description:'Noticias de América Latina y el mundo.',keywords:'Uruguay,Argentina,Brasil,Paraguay,América Latina,Mercosur,Latinoamérica'},
 {name:'Presidencia del Uruguay',url:'https://www.gub.uy/presidencia/comunicacion/noticias',feed:'',category:'uruguay',description:'Comunicados e información oficial de Presidencia de Uruguay.',keywords:''},
 {name:'Xataka',url:'https://www.xataka.com/',feed:'https://www.xataka.com/feedburner.xml',category:'tecnologia',description:'Tecnología, ciencia e innovación.',keywords:'inteligencia artificial,informática,ciencia,innovación,IA,OpenAI,ordenador,computación'}
];
