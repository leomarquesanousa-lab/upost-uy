const desks=[['te-explicamos','Te explicamos'],['opinion','Opinión'],['investigaciones','Investigaciones'],['especialistas','Especialistas'],['deportes','Deportes'],['cultura','Cultura'],['podcast','Podcast']];
export function distributeNews(news) {
 const unique=[...new Map(news.map(item=>[item.id,item])).values()];
 const ranked=unique.sort((a,b)=>Number(Boolean(b.urgent))-Number(Boolean(a.urgent))||Number(Boolean(b.featured))-Number(Boolean(a.featured))||new Date(b.visible_at).getTime()-new Date(a.visible_at).getTime());
 const lead=ranked.slice(0,7),used=new Set(lead.map(item=>item.id));
 const blocks=desks.map(([slug,label])=>{
  const items=ranked.filter(item=>!used.has(item.id)&&item.categories.some(category=>category.active&&category.slug===slug)).slice(0,3);
  items.forEach(item=>used.add(item.id));
  return {slug,label,items};
 });
 return {lead,blocks,more:ranked.filter(item=>!used.has(item.id)).slice(0,6)};
}
