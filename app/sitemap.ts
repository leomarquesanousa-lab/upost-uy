import type { MetadataRoute } from 'next';
import {siteUrl} from '@/lib/editorial/seo';import {sitemapNews} from '@/server/repositories/editorial';import {sections} from '@/lib/portal';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const news=await sitemapNews();const base=siteUrl();return [...['','noticias','videos','radios','medios-asociados','contacto','politica-de-privacidade','termos-de-uso','politica-de-cookies',...sections.map(([s])=>s)].map(path=>({url:path?base+'/'+path:base})),...news.map(n=>({url:base+'/noticias/'+n.slug,lastModified:n.updated_at}))];}
