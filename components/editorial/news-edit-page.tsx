import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireEditorial } from '@/lib/auth/editorial';
import { newsById, taxonomyList } from '@/server/repositories/editorial';
import { NewsForm } from './news-form';
import { NewsComposer } from './news-composer';
import {newsLifecycle,retentionPolicy} from '@/server/services/news-lifecycle';
import {NewsLifecycleControls} from './news-lifecycle-controls';
export async function NewsEditPage({ id }: { id?: string }) {
  const actor=await requireEditorial();
  if (id && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) notFound();
  const [item,authors,categories] = await Promise.all([id ? newsById(id) : undefined,taxonomyList('authors'),taxonomyList('categories')]);
  if (id && !item) notFound();
  const state=id?await newsLifecycle(id):null,ready=id?(await retentionPolicy()).ready:false;
  return <><Link href="/admin/noticias">← Noticias</Link><h1 className="form-title">{id ? 'Editar noticia' : 'Nueva noticia'}</h1>{item ? <><NewsLifecycleControls id={item.id} detail ready={ready} permanent={state?.permanent} protectedItem={state?.editorial_protected} admin={actor.role!=='EDITOR'}/><NewsForm item={item} authors={authors} categories={categories} /></> : <NewsComposer authors={authors} categories={categories} />}</>;
}
