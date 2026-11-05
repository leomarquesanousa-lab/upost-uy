import Link from 'next/link';
import { listNews, taxonomyList, queryValue } from '@/server/repositories/editorial';
import { NewsCard } from './news-card';
import { Pagination } from './pagination';
export async function PublicNews({ query, search = false, title }: { query: Record<string,string|string[]|undefined>; search?: boolean; title?: string }) {
  const filters = { q: queryValue(query.q), category: queryValue(query.category), page: queryValue(query.page) };
  const [result,categories] = await Promise.all([listNews(filters),taxonomyList('categories',true)]);
  return <><p className="eyebrow">PERIODISTAS EN RED</p><h1>{title || (search ? 'Buscar noticias' : 'Noticias')}</h1>
    <form className="filters public-filters" action={search ? '/busca' : '/noticias'}><label>Buscar noticias<input type="search" name="q" maxLength={200} defaultValue={filters.q} placeholder="¿Qué estás buscando?" /></label>
      <label>Categoría<select name="category" defaultValue={filters.category}><option value="">Todas las categorías</option>{categories.map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}</select></label><button className="button">Buscar</button></form>
    <nav className="category-tags" aria-label="Categorías"><Link href="/noticias">Todas</Link>{categories.map(c=><Link href={`/noticias?category=${c.slug}`} key={c.id}>{c.name}</Link>)}</nav>
    <div className="section-heading"><h2>{search ? `Resultados${filters.q ? ` para “${filters.q}”` : ''}` : 'Últimas noticias'}</h2><span>{result.count} noticia(s)</span></div>
    <div className="news-grid">{result.items.map(item=><NewsCard news={item} key={item.id} />)}</div>
    {!result.count && <p className="empty-state">No hay noticias publicadas{filters.q ? ' para esta búsqueda' : ''}.</p>}
    <Pagination base={search ? '/busca' : '/noticias'} page={result.page} pages={result.pages} params={filters} />
  </>;
}
