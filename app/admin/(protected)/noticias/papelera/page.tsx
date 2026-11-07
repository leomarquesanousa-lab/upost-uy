import Link from 'next/link';
import {requireEditorial} from '@/lib/auth/editorial';
import {trashNews} from '@/server/services/news-lifecycle';
import {NewsLifecycleControls} from '@/components/editorial/news-lifecycle-controls';
import {Pagination} from '@/components/editorial/pagination';
export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}){
 const actor=await requireEditorial(),d=await trashNews(Number((await searchParams).page||1));
 return <><Link href="/admin/noticias">← Noticias</Link><h1>Papelera y noticias vencidas</h1><p>Restaurar conserva la noticia como borrador protegido; no la publica automáticamente. Las noticias enviadas manualmente a Papelera no se eliminan por la rutina automática.</p>
 {!d.ready?<p>Requiere activar la migración 011.</p>:d.items.length?<div className="table-scroll"><table><thead><tr><th>Título</th><th>Motivo</th><th>Recuperación hasta</th><th>Acciones</th></tr></thead><tbody>{d.items.map(n=><tr key={n.id}><td>{n.title}</td><td>{n.trash_reason==='manual'?'Eliminación manual':'Vencimiento automático'}</td><td>{n.purge_after?new Date(n.purge_after).toLocaleString('es-UY',{timeZone:'America/Montevideo'}):'Sin eliminación automática'}</td><td><NewsLifecycleControls id={n.id} trash permanent={n.permanent} protectedItem={n.editorial_protected} admin={actor.role!=='EDITOR'}/></td></tr>)}</tbody></table></div>:<p>No hay noticias en Papelera.</p>}<Pagination base="/admin/noticias/papelera" page={d.page} pages={d.pages}/></>;
}
