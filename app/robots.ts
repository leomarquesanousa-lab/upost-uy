import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/editorial/seo';
export default function robots(): MetadataRoute.Robots {
  return { rules:{userAgent:'*',allow:'/',disallow:['/admin','/api/','/busca']},sitemap:`${siteUrl()}/sitemap.xml` };
}
