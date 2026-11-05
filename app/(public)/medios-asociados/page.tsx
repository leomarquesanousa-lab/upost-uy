import Image from 'next/image';
import Link from 'next/link';
import {portalResources} from '@/server/services/portal-resources';
import {listNews} from '@/server/repositories/editorial';
import {NewsCard} from '@/components/editorial/news-card';
import {automationData} from '@/server/services/source-automation';
import styles from '@/components/editorial/associated-media.module.css';
export const metadata={title:'Medios asociados y fuentes | UPOST.uy'};
export default async function MediaPage({searchParams}:{searchParams:Promise<{fuente?:string;page?:string}>}){
 const query=await searchParams,selected=query.fuente;
 const [partners,sources]=await Promise.all([portalResources('partner'),portalResources('source')]);
 const automation=await automationData();
 const items=[...partners.items,...sources.items].filter(item=>!selected||item.id===selected);
 return <section className={styles.directory}><p className="eyebrow">PERIODISTAS EN RED</p><h1>Medios asociados y fuentes</h1><p className={styles.intro}>Los medios asociados forman parte de nuestra red. Las fuentes externas se identifican por su origen y no implican una asociación formal. Cada noticia enlaza a la publicación original.</p>{selected&&<Link href="/medios-asociados">← Todos los medios y fuentes</Link>}{!items.length&&<p>Todavía no hay medios o fuentes disponibles.</p>}{await Promise.all(items.map(async item=>{
 const news=await listNews({source:item.name,sourceId:automation.ready?item.id:undefined,limit:selected?12:3,page:selected?query.page:undefined});
 return <section className={styles.source} key={item.id}>
  <div className={styles.sourceHeader}>{item.image_url&&<Image src={item.image_url} width={140} height={52} alt=""/>}<div><h2>{item.name}</h2><small>{item.kind==='partner'?'Medio asociado':'Fuente externa'}</small></div></div>
  <p>{item.description}</p><p><a href={item.url} target="_blank" rel="noopener noreferrer">Sitio original ↗</a>{!selected&&<> · <Link href={'/medios-asociados?fuente='+item.id}>Ver noticias de esta fuente →</Link></>}</p>
  {news.items.length?<div className={styles.news}>{news.items.map(n=><NewsCard key={n.id} news={n}/>)}</div>:<p>Aún no hay noticias publicadas de esta fuente.</p>}
  {selected&&news.pages>1&&<nav className={styles.pagination} aria-label="Páginas de noticias de la fuente">{news.page>1&&<Link href={'/medios-asociados?fuente='+item.id+'&page='+(news.page-1)}>← Anteriores</Link>}<span>{news.page} / {news.pages}</span>{news.page<news.pages&&<Link href={'/medios-asociados?fuente='+item.id+'&page='+(news.page+1)}>Siguientes →</Link>}</nav>}
 </section>;
  }))}</section>;
}
