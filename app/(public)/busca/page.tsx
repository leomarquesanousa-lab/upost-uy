import type { Metadata } from 'next';
import { PublicNews } from '@/components/editorial/public-news';
export const metadata: Metadata = { title: 'Busca | Biosfera', robots: { index: false, follow: true } };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <PublicNews query={await searchParams} search />; }
