/* eslint-disable @next/next/no-img-element -- uploads locais já limitados a 2400px */
import Link from 'next/link';
import { Brand } from '@/components/brand';
import type { News } from '@/lib/editorial/types';
export function NewsCard({ news, featured = false, home = false }: { news: News; featured?: boolean; home?: boolean }) {
  if (home) return <article className="news-card home-news-card">
    <Link className="home-news-link" href={`/noticias/${news.slug}`}>
      <div className="home-news-media">{news.cover_image
        ? <img src={news.cover_image} alt="" loading="lazy" />
        : <div className="home-news-placeholder" aria-hidden="true"><Brand light/></div>}</div>
      <div className="home-news-copy">
        <div className="home-news-category">{news.categories.filter(c=>c.active).map(c=>c.name).join(' · ') || 'Biosfera'}</div>
        <h2>{news.title}</h2>
        <small>{news.visible_at && <time dateTime={new Date(news.visible_at).toISOString()}>{new Date(news.visible_at).toLocaleDateString('pt-BR',{timeZone:'UTC'})}</time>}</small>
      </div>
    </Link>
  </article>;
  return <article className={`news-card ${featured ? 'featured-news' : ''}`}>
    <Link className="news-card-media" href={`/noticias/${news.slug}`} tabIndex={-1} aria-hidden="true">{news.cover_image ? <img src={news.cover_image} alt="" loading={featured ? 'eager' : 'lazy'} /> : <div className="home-news-placeholder"><Brand light/></div>}</Link>
    <div className="news-card-copy"><div className="category-tags">{news.categories.filter(c=>c.active).map(category=><Link key={category.id} href={`/noticias?category=${category.slug}`}>{category.name}</Link>)}</div>
      <h2><Link href={`/noticias/${news.slug}`}>{news.title}</Link></h2><p>{news.excerpt || news.subtitle}</p>
      <small>{news.author_name} · {news.visible_at && new Date(news.visible_at).toLocaleDateString('pt-BR',{timeZone:'UTC'})}</small>
    </div>
  </article>;
}
