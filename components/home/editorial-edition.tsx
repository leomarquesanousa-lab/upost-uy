import Link from 'next/link';
import type {ReactNode} from 'react';
import {NewsCard} from '@/components/editorial/news-card';
import {distributeNews} from '@/lib/editorial/distribution.mjs';
import type {NewsCardData as News} from '@/lib/editorial/types';
import styles from '@/app/(public)/home.module.css';

export function EditorialEdition({items,interlude}:{items:News[];interlude?:ReactNode}) {
 const {lead,more,blocks}=distributeNews(items) as {lead:News[];more:News[];blocks:{slug:string;label:string;items:News[]}[]};
 const heading=(title:string,href='/noticias')=><div className="section-heading"><h3>{title}</h3><Link href={href}>Ver más →</Link></div>;
 if(!lead.length)return <section className="editorial-empty"><p className="eyebrow">UPOST.uy</p><h2>La verdad nos une.</h2><p>Las noticias aparecerán aquí cuando el equipo editorial publique sus primeras notas.</p><Link href="/noticias">Explorar noticias →</Link></section>;
 return <>
  {items.find(n=>n.urgent)&&<aside className="breaking-news" aria-label="Último momento"><strong>ÚLTIMO MOMENTO</strong><Link href={'/noticias/'+items.find(n=>n.urgent)!.slug}>{items.find(n=>n.urgent)!.title} →</Link></aside>}
  <section className={`${styles.leadGrid} ${lead.length===1?styles.singleStory:''}`} aria-label="Noticias destacadas">
   <NewsCard news={lead[0]} featured/>
   {lead.slice(1).map(n=><NewsCard key={n.id} news={n} compact/>)}
  </section>
  {(blocks.length>0||more.length>0)&&<section className="editorial-section" aria-label="Más noticias"><h2>Más noticias</h2>
   {blocks.map(b=><section className={styles.categoryGroup} key={b.slug} data-home-category={b.slug}>{heading(b.label,'/noticias?category='+encodeURIComponent(b.slug))}<div className={`news-grid ${styles.moreGrid} ${b.slug==='mundo'?styles.worldGrid:b.slug==='deportes'?`${styles.sportsGrid} ${styles.categoryList} ${b.items.length===2?styles.sportsPair:b.items.length===1?styles.sportsSingle:''}`:''}`}>{b.items.map((n,i)=><NewsCard key={n.id} news={n} compact={b.slug==='deportes'||b.slug==='mundo'&&i>=3}/>)}</div></section>)}
   {more.length>0&&<div className={`news-grid ${styles.moreGrid}`}>{more.map(n=><NewsCard key={n.id} news={n}/>)}</div>}
   <Link className={styles.moreLink} href="/noticias">Ver más →</Link>
  </section>}
  {interlude}
 </>;
}
