import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireEditorial } from '@/lib/auth/editorial';
import { newsById, taxonomyList } from '@/server/repositories/editorial';
import { NewsForm } from './news-form';
import { NewsComposer } from './news-composer';
export async function NewsEditPage({ id }: { id?: string }) {
  await requireEditorial();
  if (id && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) notFound();
  const [item,authors,categories] = await Promise.all([id ? newsById(id) : undefined,taxonomyList('authors'),taxonomyList('categories')]);
  if (id && !item) notFound();
  return <><Link href="/admin/noticias">← Notícias</Link><h1 className="form-title">{id ? 'Editar notícia' : 'Nova notícia'}</h1>{item ? <NewsForm item={item} authors={authors} categories={categories} /> : <NewsComposer authors={authors} categories={categories} />}</>;
}
