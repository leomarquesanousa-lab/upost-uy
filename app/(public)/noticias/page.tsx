import type { Metadata } from 'next';
import { PublicNews } from '@/components/editorial/public-news';
import { pageMetadata } from '@/lib/editorial/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Noticias | UPOST.uy',
  description: 'Últimas noticias, informação e contenidos publicados pela UPOST.uy.',
  path: '/noticias',
});

export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  return <PublicNews query={await searchParams} />;
}
