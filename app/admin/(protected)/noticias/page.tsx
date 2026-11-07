import Link from 'next/link';
import styles from './news-list.module.css';
import { listNews, taxonomyList, queryValue } from '@/server/repositories/editorial';
import { statusLabels, statuses } from '@/lib/editorial/validation';
import { NewsLifecycleControls } from '@/components/editorial/news-lifecycle-controls';
import { Pagination } from '@/components/editorial/pagination';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  const filters = Object.fromEntries(['q','status','category','author','page'].map(key=>[key,queryValue(query[key])]));
  const [result,categories,authors] = await Promise.all([listNews(filters,true),taxonomyList('categories'),taxonomyList('authors')]);
  return <section className={styles.list}><p className="eyebrow">NÚCLEO EDITORIAL</p><div className={`editorial-heading ${styles.heading}`}><h1>Noticias</h1><Link href="/admin/noticias/papelera">Papelera y vencidas</Link><Link className="button" href="/admin/noticias/nova">Nueva noticia</Link></div>
    {query.salvo==='1' && <p className="success-message" role="status">Noticia guardada.</p>}
    <form className={`filters ${styles.filters}`} action="/admin/noticias"><label>Buscar<input name="q" maxLength={200} defaultValue={filters.q} placeholder="Título, subtítulo o resumen" /></label>
      <label>Status<select name="status" defaultValue={filters.status}><option value="">Todos</option>{statuses.map(status=><option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
      <label>Categoría<select name="category" defaultValue={filters.category}><option value="">Todas</option>{categories.map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}</select></label>
      <label>Autor<select name="author" defaultValue={filters.author}><option value="">Todos</option>{authors.map(a=><option key={a.id} value={a.slug}>{a.name}</option>)}</select></label><button className="button">Filtrar</button><Link href="/admin/noticias">Limpiar</Link></form>
    <p>{result.count} noticia(s)</p><div className="table-scroll"><table className={styles.table}><thead><tr><th>Título</th><th>Categoría</th><th>Autor</th><th>Status</th><th>Fecha (Uruguay)</th><th>Destacada</th><th>Actualización (Uruguay)</th><th>Acciones</th></tr></thead><tbody>{result.items.map(item=><tr key={item.id}><td><Link className={styles.title} title={item.title} href={`/admin/noticias/${item.id}`}>{item.title}</Link></td><td>{item.categories.map(c=>c.name).join(', ')}</td><td>{item.author_name}</td><td>{statusLabels[item.status]}{item.status==='SCHEDULED' && item.scheduled_at && item.scheduled_at <= new Date() && <small> · Publicada</small>}</td><td>{(item.status==='SCHEDULED' ? item.scheduled_at : item.published_at)?.toLocaleString('es-UY',{timeZone:'America/Montevideo',dateStyle:'short',timeStyle:'short'}) || '—'}</td><td>{item.featured ? 'Sí' : 'No'}</td><td>{item.updated_at.toLocaleString('es-UY',{timeZone:'America/Montevideo',dateStyle:'short',timeStyle:'short'})}</td><td><div className={styles.actions}><Link title="Editar noticia" href={`/admin/noticias/${item.id}`}>Editar →</Link><NewsLifecycleControls id={item.id} compact/></div></td></tr>)}</tbody></table></div>
    {!result.count && <p className="empty-state">No se encontraron noticias.</p>}<Pagination base="/admin/noticias" page={result.page} pages={result.pages} params={filters} /></section>;
}
