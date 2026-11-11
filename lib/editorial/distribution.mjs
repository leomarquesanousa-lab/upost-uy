const chronological=(a,b)=>new Date(b.visible_at).getTime()-new Date(a.visible_at).getTime()||String(a.id).localeCompare(String(b.id));
export function hasEditorialPhoto(news){
 const value=String(news.cover_image||'');
 return Boolean(value&&!/\.(svg|ico)(?:\?|$)|(?:^|[\/_.-])(?:logos?|favicons?|avatars?|placeholders?|fallback)(?:[\/_.-]|$)/i.test(value)&&!/^\s*(?:logo(?:tipo)?|favicon)(?:\s|$)/i.test(news.cover_alt||''));
}
export function distributeNews(news) {
 const unique=[...new Map(news.map(item=>[item.id,item])).values()];
 const recent=unique.sort(chronological),used=new Set();
 const take=(items,count)=>items.filter(n=>!used.has(n.id)).slice(0,count).map(n=>{used.add(n.id);return n;});
 const ranked=[...recent].sort((a,b)=>Number(Boolean(b.home_lead))-Number(Boolean(a.home_lead))||Number(Boolean(b.urgent))-Number(Boolean(a.urgent))||Number(Boolean(b.featured))-Number(Boolean(a.featured))||chronological(a,b));
 const lead=take(ranked,7);
 const priority=['uruguay','mundo','deportes'];
 const categories=[...new Map(recent.flatMap(n=>n.categories.filter(c=>c.active&&c.slug!=='podcast').map(c=>[c.slug,c]))).values()];
 const position=slug=>priority.includes(slug)?priority.indexOf(slug):priority.length;
 categories.sort((a,b)=>position(a.slug)-position(b.slug)||String(a.name||a.slug).localeCompare(String(b.name||b.slug),'es'));
 const blocks=categories.map(c=>({slug:c.slug,label:c.name||c.slug,items:take(recent.filter(n=>n.categories.some(cat=>cat.active&&cat.slug===c.slug)),recent.length)})).filter(b=>b.items.length);
 return {lead,blocks,more:take(recent,recent.length)};
}
