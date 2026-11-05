import type {Metadata} from 'next';
import Link from 'next/link';
import {SourceNews} from '@/components/editorial/source-news';
import {AdBanner} from '@/components/ads/banner';
import {NewsCard} from '@/components/editorial/news-card';
import {adPositions} from '@/lib/admin/policy.mjs';
import {pageMetadata,jsonLd,siteUrl} from '@/lib/editorial/seo';
import {distributeNews} from '@/lib/editorial/distribution.mjs';
import {homeNews} from '@/server/repositories/editorial';
import styles from './home.module.css';
import {TopBanners} from '@/components/ads/top-banners';

export const metadata:Metadata=pageMetadata({
  title:'UPOST.uy | Noticias de Uruguay y el mundo',
  description:'Periodistas en Red. La verdad nos une.',path:'/'
});

export default async function Home(){
  const news=await homeNews();
  const {lead,blocks,more}=distributeNews([...news.lead,...news.recent]);
  return <div className={`upost-home ${styles.home}`}>
    <TopBanners/>
    {lead[0]?.urgent&&<aside className="breaking-news" aria-label="Último momento"><strong>ÚLTIMO MOMENTO</strong><Link href={'/noticias/'+lead[0].slug}>{lead[0].title} →</Link></aside>}
    {lead.length>0?<section className={`${styles.leadGrid} ${lead.length===1 ? styles.singleStory : ""}`} aria-label="Noticias destacadas">
      <NewsCard news={lead[0]} featured/>
      {lead.slice(1).map(n=><NewsCard key={n.id} news={n} compact/>)}
    </section>:<section className="editorial-empty">
      <p className="eyebrow">UPOST.uy</p><h2>La verdad nos une.</h2>
      <p>Las noticias aparecerán aquí cuando el equipo editorial publique sus primeras notas.</p>
      <Link href="/noticias">Explorar noticias →</Link>
    </section>}
    {more.length>0&&<section className="editorial-section"><h2>Más noticias</h2><div className={`news-grid ${styles.moreGrid}`}>{more.slice(0,4).map(n=><NewsCard key={n.id} news={n}/>)}</div><Link className={styles.moreLink} href="/noticias">Ver más →</Link></section>}
    <AdBanner position={adPositions.homeBetween}/>
    {blocks.filter(b=>b.items.length).map(b=><section key={b.slug} className="editorial-section">
      <div className="section-heading"><h2>{b.label}</h2><Link href={'/noticias?category='+b.slug}>Ver más →</Link></div>
      <div className={styles.categoryList}>{b.items.slice(0,5).map(n=><NewsCard key={n.id} news={n} compact/>)}</div>
    </section>)}
    <SourceNews/>
    <AdBanner position={adPositions.homeBottom}/>
    <section className={`portal-directory ${styles.directory}`} aria-label="Explorá UPOST">
      <Link href="/videos"><h2>Videos</h2><p>Entrevistas y reportajes →</p></Link>
      <Link href="/podcast"><h2>Podcast</h2><p>Historias para escuchar →</p></Link>
    </section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@type':'WebSite',name:'UPOST.uy',url:siteUrl(),inLanguage:'es-UY'})}}/>
  </div>;
}
