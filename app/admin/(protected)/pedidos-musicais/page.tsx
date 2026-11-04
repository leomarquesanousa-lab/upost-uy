import { requireEditorial } from '@/lib/auth/editorial';
import { getPool } from '@/lib/db/pool';
import { Pagination } from '@/components/editorial/pagination';
export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}) {
  await requireEditorial();
  const count=Number((await getPool().query('SELECT count(*) FROM song_requests')).rows[0].count);
  const pages=Math.max(1,Math.ceil(count/30));
  const page=Math.min(pages,Math.max(1,Number.parseInt((await searchParams).page || '1',10)||1));
  const requests=(await getPool().query('SELECT name,song,message,status,created_at FROM song_requests ORDER BY created_at DESC,id LIMIT 30 OFFSET $1',[(page-1)*30])).rows;
  return <><p className="eyebrow">PARTICIPAÇÃO DOS OUVINTES</p><h1>Pedidos musicais</h1><p>{count} pedido(s). Visualização interna da equipe.</p><div className="table-scroll"><table><thead><tr><th>Nome</th><th>Música / artista</th><th>Mensagem</th><th>Data (UTC)</th><th>Status</th></tr></thead><tbody>{requests.map((item,index)=><tr key={index}><td>{item.name}</td><td>{item.song}</td><td>{item.message || '—'}</td><td>{item.created_at.toISOString().slice(0,16).replace('T',' ')}</td><td>{item.status}</td></tr>)}</tbody></table></div>{!count && <p>Aguardando os primeiros pedidos dos ouvintes.</p>}<Pagination base="/admin/pedidos-musicais" page={page} pages={pages} /></>;
}
