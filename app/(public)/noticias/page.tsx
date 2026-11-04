import type { Metadata } from 'next';
import { PublicNews } from '@/components/editorial/public-news';
import { pageMetadata } from '@/lib/editorial/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Notícias | Biosfera Rádio TV Web',
  description: 'Últimas notícias, informação e conteúdos publicados pela Biosfera Rádio TV Web.',
  path: '/noticias',
});

export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  return <PublicNews query={await searchParams} />;
}
