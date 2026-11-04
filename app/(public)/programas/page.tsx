import type { Metadata } from 'next';
import { PublicCatalog } from '@/components/programming/public';
import { pageMetadata } from '@/lib/editorial/seo';

export const dynamic='force-dynamic';
export const metadata: Metadata = pageMetadata({
  title: 'Programas | Biosfera Rádio TV Web',
  description: 'Conheça os programas da Biosfera Rádio TV Web e acompanhe seus apresentadores e horários.',
  path: '/programas',
});

export default function Page(){return <PublicCatalog kind="programs"/>;}
