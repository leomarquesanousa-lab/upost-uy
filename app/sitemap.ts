import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/editorial/seo';
import { sitemapNews } from '@/server/repositories/editorial';
import { publicProgramming } from '@/server/services/programming';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [news,programming] = await Promise.all([sitemapNews(),publicProgramming()]);
  const base = siteUrl();
  const staticPages = [
    '',
    'noticias',
    'radio',
    'programacao',
    'programas',
    'apresentadores',
    'videos',
    'contato',
  ];

  return [
    ...staticPages.map(path=>({url:path?`${base}/${path}`:base})),
    ...programming.programs.map(p=>({url:`${base}/programas/${p.slug}`})),
    ...programming.presenters.map(p=>({url:`${base}/apresentadores/${p.slug}`})),
    ...news.map(item=>({url:`${base}/noticias/${item.slug}`,lastModified:item.updated_at})),
  ];
}
