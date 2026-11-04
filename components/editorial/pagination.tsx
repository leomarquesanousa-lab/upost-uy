import Link from 'next/link';
export function Pagination({ base, page, pages, params = {} }: { base: string; page: number; pages: number; params?: Record<string,string> }) {
  const href = (number: number) => { const query = new URLSearchParams(params); query.set('page',String(number)); return `${base}?${query}`; };
  if (pages <= 1) return null;
  return <nav className="pagination" aria-label="Paginação">{page > 1 && <Link href={href(page-1)}>← Anterior</Link>}<span>Página {page} de {pages}</span>{page < pages && <Link href={href(page+1)}>Próxima →</Link>}</nav>;
}
