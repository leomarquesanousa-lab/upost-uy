import Link from 'next/link';
import { listNews, taxonomyList, queryValue } from '@/server/repositories/editorial';
import { statusLabels, statuses } from '@/lib/editorial/validation';
import { Pagination } from '@/components/editorial/pagination';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  const filters = Object.fromEntries(['q','status','category','author','page'].map(key=>[key,queryValue(query[key])]));
  const [result,categories,authors] = await Promise.all([listNews(filters,true),taxonomyList('categories'),taxonomyList('authors')]);
  return <><p className="eyebrow">NÚCLEO EDITORIAL</p><div className="editorial-heading"><h1>Notícias</h1><Link className="button" href="/admin/noticias/nova">Nova notícia</Link></div>
    {query.salvo==='1' && <p className="success-message" role="status">Notícia salva com sucesso.</p>}
    <form className="filters" action="/admin/noticias"><label>Busca<input name="q" maxLength={200} defaultValue={filters.q} placeholder="Título, subtítulo ou resumo" /></label>
      <label>Status<select name="status" defaultValue={filters.status}><option value="">Todos</option>{statuses.map(status=><option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
      <label>Categoria<select name="category" defaultValue={filters.category}><option value="">Todas</option>{categories.map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}</select></label>
      <label>Autor<select name="author" defaultValue={filters.author}><option value="">Todos</option>{authors.map(a=><option key={a.id} value={a.slug}>{a.name}</option>)}</select></label><button className="button">Filtrar</button><Link href="/admin/noticias">Limpar</Link></form>
    <p>{result.count} notícia(s)</p><div className="table-scroll"><table><thead><tr><th>Título</th><th>Categoria</th><th>Autor</th><th>Status</th><th>Data (UTC)</th><th>Destaque</th><th>Atualização (UTC)</th><th>Ações</th></tr></thead><tbody>{result.items.map(item=><tr key={item.id}><td>{item.title}</td><td>{item.categories.map(c=>c.name).join(', ')}</td><td>{item.author_name}</td><td>{statusLabels[item.status]}{item.status==='SCHEDULED' && item.scheduled_at && item.scheduled_at <= new Date() && <small> · No ar</small>}</td><td>{(item.status==='SCHEDULED' ? item.scheduled_at : item.published_at)?.toISOString().slice(0,16).replace('T',' ') || '—'}</td><td>{item.featured ? 'Sim' : 'Não'}</td><td>{item.updated_at.toISOString().slice(0,16).replace('T',' ')}</td><td><Link href={`/admin/noticias/${item.id}`}>Editar →</Link></td></tr>)}</tbody></table></div>
    {!result.count && <p className="empty-state">Nenhuma notícia encontrada.</p>}<Pagination base="/admin/noticias" page={result.page} pages={result.pages} params={filters} /></>;
}
