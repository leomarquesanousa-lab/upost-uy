import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireEditorial } from '@/lib/auth/editorial';
import { taxonomyList, taxonomyById } from '@/server/repositories/editorial';
import type { TaxonomyKind } from '@/lib/editorial/types';
import { TaxonomyForm } from './taxonomy-form';
const info = {
  categories: { label: 'Categorias', singular: 'categoria', base: '/admin/categorias', create: 'nova' },
  authors: { label: 'Autores', singular: 'autor', base: '/admin/autores', create: 'novo' },
};
export async function TaxonomyIndex({ kind }: { kind: TaxonomyKind }) {
  await requireEditorial();
  const items = await taxonomyList(kind);
  const config = info[kind];
  return <><p className="eyebrow">NÚCLEO EDITORIAL</p><div className="editorial-heading"><h1>{config.label}</h1><Link className="button" href={`${config.base}/${config.create}`}>Criar {config.singular}</Link></div>
    {!items.length ? <p className="empty-state">Nenhum registro cadastrado.</p> : <div className="table-scroll"><table><thead><tr><th>Nome</th><th>Slug</th><th>Status</th><th>Ações</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.slug}</td><td>{item.active ? 'Ativo' : 'Inativo'}</td><td><Link href={`${config.base}/${item.id}`}>Editar →</Link></td></tr>)}</tbody></table></div>}</>;
}
export async function TaxonomyEdit({ kind, id }: { kind: TaxonomyKind; id?: string }) {
  await requireEditorial();
  const config = info[kind];
  if (id && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) notFound();
  const item = id ? await taxonomyById(kind,id) : undefined;
  if (id && !item) notFound();
  return <><Link href={config.base}>← {config.label}</Link><h1 className="form-title">{id ? 'Editar' : 'Criar'} {config.singular}</h1><TaxonomyForm kind={kind} item={item || undefined} /></>;
}
