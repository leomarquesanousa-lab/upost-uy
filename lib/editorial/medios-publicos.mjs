export const mediosPublicosSource={
 name:'Medios Públicos',url:'https://mediospublicos.uy/category/noticias/',feed:'https://mediospublicos.uy/category/noticias/feed/',category:'uruguay',
 description:'Noticias de los medios públicos del Uruguay; resúmenes y enlaces originales.',keywords:'',
 categoryLabel:'Nacionales → Uruguay · Internacionales → Mundo · Cultura · Deportes',
 feeds:['nacionales','internacionales','cultura','deportes'].map(tag=>'https://mediospublicos.uy/tag/'+tag+'/feed/'),
};
export function isMediosPublicos(value){try{return /^(www\.)?mediospublicos\.uy$/i.test(new URL(value).hostname);}catch{return false;}}
export function mediosPublicosCategory(tags){
 const words=String(tags||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^a-z]+/);
 if(!words.includes('noticias'))return '';
 // Specific desks take precedence when a story also carries the broad Nacionales tag.
 return [['deportes','deportes'],['cultura','cultura'],['internacionales','mundo'],['nacionales','uruguay']].find(([tag])=>words.includes(tag))?.[1]||'';
}
export function sourceFeedUrls(source){
 if(!source.feed_url)return [];
 return isMediosPublicos(source.url)&&source.feed_url.replace(/\/$/,'')===mediosPublicosSource.feed.replace(/\/$/,'')?[...mediosPublicosSource.feeds]:[source.feed_url];
}
export function interleaveSourceEntries(groups){
 const seen=new Set(),result=[];
 for(let index=0;index<Math.max(0,...groups.map(group=>group.length))&&result.length<150;index++)for(const group of groups){
  const entry=group[index];if(entry&&!seen.has(entry.url)&&result.length<150){seen.add(entry.url);result.push(entry);}
 }
 return result;
}
export function mediosPublicosPhoto(value,alt=''){
 try{const url=new URL(value);return !/(?:^|[\/_.-])(?:logos?|icons?|banners?|favicons?|placeholders?|fallback|avatars?|spacer|pixel|default)(?:[\/_.-]|$)/i.test(decodeURIComponent(url.pathname))&&!/^(?:portal\s+)?medios\s+p[uú]blicos$/i.test(String(alt).trim());}catch{return false;}
}
