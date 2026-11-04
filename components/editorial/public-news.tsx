import Link from 'next/link';
import { listNews, taxonomyList, queryValue } from '@/server/repositories/editorial';
import { NewsCard } from './news-card';
import { Pagination } from './pagination';
export async function PublicNews({ query, search = false }: { query: Record<string,string|string[]|undefined>; search?: boolean }) {
  const filters = { q: queryValue(query.q), category: queryValue(query.category), page: queryValue(query.page) };
  const [result,categories] = await Promise.all([listNews(filters),taxonomyList('categories',true)]);
  return <><p className="eyebrow">JORNALISMO BIOSFERA</p><h1>{search ? 'Busca de notícias' : 'Notícias'}</h1>
    <form className="filters public-filters" action={search ? '/busca' : '/noticias'}><label>Buscar notícias<input type="search" name="q" maxLength={200} defaultValue={filters.q} placeholder="O que você procura?" /></label>
      <label>Categoria<select name="category" defaultValue={filters.category}><option value="">Todas as categorias</option>{categories.map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}</select></label><button className="button">Buscar</button></form>
    <nav className="category-tags" aria-label="Categorias"><Link href="/noticias">Todas</Link>{categories.map(c=><Link href={`/noticias?category=${c.slug}`} key={c.id}>{c.name}</Link>)}</nav>
    <div className="section-heading"><h2>{search ? `Resultados${filters.q ? ` para “${filters.q}”` : ''}` : 'Últimas notícias'}</h2><span>{result.count} notícia(s)</span></div>
    <div className="news-grid">{result.items.map(item=><NewsCard news={item} key={item.id} />)}</div>
    {!result.count && <p className="empty-state">Nenhuma notícia publicada encontrada{filters.q ? ' para esta busca' : ''}.</p>}
    <Pagination base={search ? '/busca' : '/noticias'} page={result.page} pages={result.pages} params={filters} />
  </>;
}
