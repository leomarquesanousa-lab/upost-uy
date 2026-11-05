/* eslint-disable @next/next/no-img-element -- registered, optimized WebP editorial photographs */
import Link from 'next/link';
import {initialSources} from '@/lib/editorial/source-sync.mjs';
import {sourceNewsHighlights} from '@/server/repositories/editorial';
import styles from './source-news.module.css';
export async function SourceNews(){
 const items=await sourceNewsHighlights(initialSources.map(s=>s.url));
 if(!items.length)return null;
 return <section className={styles.section} aria-label="Noticias de nuestras fuentes" data-source-news>
  <div className={styles.heading}><h2>Noticias de nuestras fuentes</h2><Link href="/medios-asociados">Todas las fuentes →</Link></div>
  <div className={styles.grid}>{items.map(news=><article className={styles.card} key={news.id} data-source-story={news.source_name}>
   <Link className={styles.media} href={'/noticias/'+news.slug} tabIndex={-1} aria-hidden="true"><img src={news.cover_image} alt="" width={800} height={500} loading="lazy"/></Link>
   <div className={styles.meta}><strong>{news.source_name}</strong><time dateTime={new Date(news.published_at!).toISOString()}>{new Intl.DateTimeFormat('es-UY',{dateStyle:'medium',timeZone:'America/Montevideo'}).format(new Date(news.published_at!))}</time></div>
   <h3><Link href={'/noticias/'+news.slug}>{news.title}</Link></h3><p className={styles.summary}>{news.excerpt}</p>
   <div className={styles.origin}>Origen: <a href={news.source_url} target="_blank" rel="noopener noreferrer">{news.source_name} ↗</a></div>
  </article>)}</div>
 </section>;
}
