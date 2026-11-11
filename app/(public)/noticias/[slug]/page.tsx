/* eslint-disable @next/next/no-img-element -- imagens normalizadas no upload */
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdBanner } from '@/components/ads/banner';
import { adPositions } from '@/lib/admin/policy.mjs';
import { notFound } from 'next/navigation';
import { publicNewsBySlug, listNews } from '@/server/repositories/editorial';
import { getSettings } from '@/server/services/settings';
import { renderBody } from '@/lib/editorial/content.mjs';
import { articleUrl, siteUrl, jsonLd,newsMetadata,sharingImage } from '@/lib/editorial/seo';
import {automaticSeo} from '@/lib/editorial/automatic-seo.mjs';
import { NewsCard } from '@/components/editorial/news-card';
import { Share } from '@/components/editorial/share';
import { brandAssets } from '@/lib/brand';
import styles from './article.module.css';

const articleDate = (date: Date) => date.toLocaleString('es-UY', {
  timeZone: 'America/Montevideo', day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const news = await publicNewsBySlug((await params).slug);
  if (!news) return { title: 'Noticia no encontrada', robots: { index:false,follow:false } };
  return newsMetadata(news);
}
export default async function Page({ params }: Props) {
  const news = await publicNewsBySlug((await params).slug);
  if (!news) notFound();
  const settings = await getSettings();
  const category = news.categories.find(c=>c.active);
  const related = await listNews({ category:category?.slug,exclude:news.id,limit:3 });
  const structured = [
    { '@context':'https://schema.org','@type':'NewsArticle',headline:news.title,description:automaticSeo(news).seo_description,
      datePublished:news.visible_at?.toISOString(),dateModified:news.updated_at.toISOString(),mainEntityOfPage:articleUrl(news),
      ...(sharingImage(news.cover_image) ? {image:[sharingImage(news.cover_image)]} : {}),
      ...(news.author_name?{author:{'@type':'Person',name:news.author_name}}:{}),publisher:{'@type':'Organization',name:settings.siteName,url:siteUrl(),logo:{'@type':'ImageObject',url:`${siteUrl()}${brandAssets.logo}`}},
    },
    { '@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'Inicio',item:siteUrl()},
      {'@type':'ListItem',position:2,name:'Noticias',item:`${siteUrl()}/noticias`},
      {'@type':'ListItem',position:3,name:news.title,item:`${siteUrl()}/noticias/${news.slug}`},
    ] },
  ];
  return <><AdBanner position={adPositions.newsTop}/><article className={`article-page ${styles.page}`}>
    <nav className={styles.breadcrumbs} aria-label="Ruta"><Link href="/">Inicio</Link><span aria-hidden="true">/</span><Link href="/noticias">Noticias</Link></nav>
    <header className={styles.header}>
      <div className={styles.categories}>{news.categories.filter(c=>c.active).map(c=><Link key={c.id} href={`/noticias?category=${c.slug}`}>{c.name}</Link>)}</div>
      <h1 className={styles.headline}>{news.title}</h1>
      {news.subtitle && <p className={styles.subtitle}>{news.subtitle}</p>}
      <div className={styles.metadata}>
        <p className={styles.byline}>Por <strong>{news.author_name}</strong></p>
        <div className={styles.dates}>
          {news.visible_at && <p>Publicado: <time dateTime={news.visible_at.toISOString()}>{articleDate(news.visible_at)}</time></p>}
          {news.visible_at && news.updated_at.getTime()-news.visible_at.getTime()>60000 && <p>Actualizado: <time dateTime={news.updated_at.toISOString()}>{articleDate(news.updated_at)}</time></p>}
          <span className={styles.timezone}>Hora de Uruguay</span>
        </div>
      </div>
      <div className={styles.share}><Share title={news.title} url={`${siteUrl()}/noticias/${news.slug}`} /></div>
    </header>
    {news.cover_image && <figure className={styles.cover}><img className="article-cover" src={news.cover_image} alt={news.cover_alt} fetchPriority="high" />{(news.cover_caption || news.cover_credit) && <figcaption>{news.cover_caption}{news.cover_credit && `${news.cover_caption ? ' · ' : ''}Crédito: ${news.cover_credit}`}</figcaption>}</figure>}
    <div className={`article-body ${styles.body}`} dangerouslySetInnerHTML={{__html:renderBody(news.body)}} />
    <footer className={styles.footer}>
      {(news.source_name || news.source_url) && <p className={styles.source}>Fuente: {news.source_url ? <a href={news.source_url} target="_blank" rel="noopener noreferrer">{news.source_name || 'Artículo original'} ↗</a> : news.source_name}</p>}
      <aside className={styles.author} aria-label="Acerca del autor">{news.author_photo && <img src={news.author_photo} alt={news.author_name} width={64} height={64} loading="lazy" />}<div><span className={styles.authorLabel}>Sobre el autor</span><strong>{news.author_name}</strong>{news.author_bio && <p>{news.author_bio}</p>}</div></aside>
    </footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(structured)}} />
  </article><AdBanner position={adPositions.newsBottom}/>{related.items.length>0 && <section className={styles.related} aria-labelledby="related-title"><div className="section-heading"><h2 id="related-title">{category ? 'Leé también' : 'Más noticias'}</h2></div><div className="news-grid">{related.items.map(item=><NewsCard key={item.id} news={item} />)}</div></section>}</>;
}
