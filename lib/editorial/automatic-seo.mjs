import {plainText} from './content.mjs';
import {load} from 'cheerio';

const clean=value=>load(plainText(String(value||''))).text().replace(/\s+/g,' ').trim();
function shorten(value,max){const text=clean(value);if(text.length<=max)return text;const part=text.slice(0,max-1);return (part.lastIndexOf(' ')>max*.6?part.slice(0,part.lastIndexOf(' ')):part).replace(/[\s,;:.!?-]+$/,'')+'…';}
export function generatedSeo(record){
 const title=clean(record.title).replace(/(?:\s*[|—–-]\s*UPOST\.uy)+$/i,'');
 return {seo_title:shorten(title,70)+' | UPOST.uy',seo_description:shorten([record.excerpt,record.subtitle,record.description,record.body,record.title].find(v=>clean(v)),160)};
}
const generic=value=>/^(?:UPOST(?:\.uy)?(?:\s*[|—-]\s*)?)?Noticias de Uruguay y el mundo(?:\s*[|—-]\s*UPOST\.uy)?$/i.test(String(value||'').trim());
export function automaticSeo(previous,next=previous,submitted=next){
 const generated=generatedSeo(next),old=generatedSeo(previous||next),result={...generated};
 for(const field of ['seo_title','seo_description']){
  const value=String(submitted?.[field]??previous?.[field]??'').trim();
  // Preserve unknown/custom nonempty values. Only known fallbacks and our own output auto-update.
  const automatic=!value||generic(value)||value===old[field];
  result[field]=automatic?generated[field]:value;
 }
 return result;
}
export function seoChanges(record){const values=automaticSeo(record);return Object.keys(values).some(k=>values[k]!==String(record[k]||''))?values:null;}
