/* eslint-disable @next/next/no-img-element -- imagens normalizadas no upload */
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdBanner } from '@/components/ads/banner';
import { adPositions } from '@/lib/admin/policy.mjs';
import { notFound } from 'next/navigation';
import { publicNewsBySlug, listNews } from '@/server/repositories/editorial';
import { getSettings } from '@/server/services/settings';
import { renderBody } from '@/lib/editorial/content.mjs';
import { articleUrl, siteUrl, jsonLd } from '@/lib/editorial/seo';
import { NewsCard } from '@/components/editorial/news-card';
import { Share } from '@/components/editorial/share';
import { brandAssets } from '@/lib/brand';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const news = await publicNewsBySlug((await params).slug);
  if (!news) return { title: 'Notícia não encontrada', robots: { index:false,follow:false } };
  const title = news.seo_title || news.title;
  const description = news.seo_description || news.excerpt || news.subtitle || news.title;
  const images = news.cover_image ? [{ url:`${siteUrl()}${news.cover_image}`,alt:news.cover_alt }] : [];
  return { title,description,alternates:{canonical:articleUrl(news)},
    openGraph:{type:'article',title,description,url:articleUrl(news),images,publishedTime:news.visible_at?.toISOString(),modifiedTime:news.updated_at.toISOString(),authors:[news.author_name],locale:'pt_BR'},
    twitter:{card:news.cover_image ? 'summary_large_image' : 'summary',title,description,images},
  };
}
export default async function Page({ params }: Props) {
  const news = await publicNewsBySlug((await params).slug);
  if (!news) notFound();
  const settings = await getSettings();
  const category = news.categories.find(c=>c.active);
  const related = await listNews({ category:category?.slug,exclude:news.id,limit:3 });
  const structured = [
    { '@context':'https://schema.org','@type':'NewsArticle',headline:news.title,description:news.excerpt || news.subtitle,
      datePublished:news.visible_at?.toISOString(),dateModified:news.updated_at.toISOString(),mainEntityOfPage:articleUrl(news),
      ...(news.cover_image ? {image:[`${siteUrl()}${news.cover_image}`]} : {}),
      author:{'@type':'Person',name:news.author_name},publisher:{'@type':'Organization',name:settings.siteName,url:siteUrl(),logo:{'@type':'ImageObject',url:`${siteUrl()}${brandAssets.logo}`}},
    },
    { '@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'Início',item:siteUrl()},
      {'@type':'ListItem',position:2,name:'Notícias',item:`${siteUrl()}/noticias`},
      {'@type':'ListItem',position:3,name:news.title,item:`${siteUrl()}/noticias/${news.slug}`},
    ] },
  ];
  return <><AdBanner position={adPositions.newsTop}/><article className="article-page"><nav className="breadcrumbs" aria-label="Caminho"><Link href="/">Início</Link> / <Link href="/noticias">Notícias</Link> / <span>{news.title}</span></nav>
    <div className="category-tags">{news.categories.filter(c=>c.active).map(c=><Link key={c.id} href={`/noticias?category=${c.slug}`}>{c.name}</Link>)}</div>
    <h1>{news.title}</h1>{news.subtitle && <p className="article-subtitle">{news.subtitle}</p>}
    <p className="byline">Por <strong>{news.author_name}</strong> · <time dateTime={news.visible_at?.toISOString()}>{news.visible_at?.toLocaleString('pt-BR',{timeZone:'UTC'})} UTC</time></p>
    {news.cover_image && <figure><img className="article-cover" src={news.cover_image} alt={news.cover_alt} /><figcaption>{news.cover_caption}{news.cover_credit && ` · Crédito: ${news.cover_credit}`}</figcaption></figure>}
    <div className="article-body" dangerouslySetInnerHTML={{__html:renderBody(news.body)}} />
    {(news.source_name || news.source_url) && <p className="article-source">Fonte: {news.source_url ? <a href={news.source_url} target="_blank" rel="noopener noreferrer">{news.source_name || 'Matéria original'} ↗</a> : news.source_name}</p>}
    <aside className="author-card">{news.author_photo && <img src={news.author_photo} alt={news.author_name} width={64} height={64} loading="lazy" />}<div><strong>{news.author_name}</strong>{news.author_bio && <p>{news.author_bio}</p>}</div></aside>
    <Share title={news.title} url={`${siteUrl()}/noticias/${news.slug}`} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(structured)}} />
  </article><AdBanner position={adPositions.newsBottom}/>{related.items.length>0 && <section><div className="section-heading"><h2>{category ? 'Leia também' : 'Mais notícias'}</h2></div><div className="news-grid">{related.items.map(item=><NewsCard key={item.id} news={item} />)}</div></section>}</>;
}
