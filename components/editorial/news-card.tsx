/* eslint-disable @next/next/no-img-element -- uploads locais já limitados a 2400px */
import Link from 'next/link';
import type { NewsCardData } from '@/lib/editorial/types';
import styles from './news-card.module.css';
export function NewsCard({ news, featured = false, home = false, compact = false, headline = false }: { news: NewsCardData; featured?: boolean; home?: boolean; compact?: boolean; headline?: boolean }) {
  if (home) return <article className="news-card home-news-card">
    <Link className="home-news-link" href={`/noticias/${news.slug}`}>
      {news.cover_image && <div className="home-news-media"><img src={news.cover_image} alt="" loading="lazy" /></div>}
      <div className="home-news-copy">
        <div className="home-news-category">{news.categories.filter(c=>c.active).map(c=>c.name).join(' · ') || 'UPOST.uy'}</div>
        <h2>{news.title}</h2>
        <small>{news.visible_at && <time dateTime={new Date(news.visible_at).toISOString()}>{new Date(news.visible_at).toLocaleDateString('es-UY',{timeZone:'America/Montevideo'})}</time>}</small>
      </div>
    </Link>
  </article>;
  return <article data-news-id={news.id} className={`news-card ${styles.card} ${compact ? styles.compact : ""} ${headline ? 'headline-news' : ''} ${featured ? 'featured-news' : ''}`}>
    {!headline && news.cover_image && <Link className="news-card-media" href={`/noticias/${news.slug}`} tabIndex={-1} aria-hidden="true"><img src={news.cover_image} alt="" decoding="async" fetchPriority={featured ? 'high' : 'auto'} loading={featured ? 'eager' : 'lazy'} /></Link>}
    <div className="news-card-copy"><div className="category-tags">{news.categories.filter(c=>c.active).map(category=><Link key={category.id} href={`/noticias?category=${category.slug}`}>{category.name}</Link>)}</div>
      <h2><Link href={`/noticias/${news.slug}`}>{news.title}</Link></h2><p>{news.excerpt || news.subtitle}</p>
      <small>{news.source_name || news.author_name} · {news.visible_at && <time dateTime={new Date(news.visible_at).toISOString()}>{new Date(news.visible_at).toLocaleDateString('es-UY',{timeZone:'America/Montevideo'})}</time>}</small>
    </div>
  </article>;
}
