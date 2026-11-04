import type { Metadata } from 'next';
import { PublicCatalog } from '@/components/programming/public';
import { pageMetadata } from '@/lib/editorial/seo';

export const dynamic='force-dynamic';
export const metadata: Metadata = pageMetadata({
  title: 'Apresentadores | Biosfera Rádio TV Web',
  description: 'Conheça os apresentadores e comunicadores da Biosfera Rádio TV Web.',
  path: '/apresentadores',
});

export default function Page(){return <PublicCatalog kind="presenters"/>;}
