import {lifecycleDashboard} from '@/server/services/news-lifecycle';
import {NewsRetentionForm} from './news-retention';
export async function NewsRetentionSummary(){
 const d=await lifecycleDashboard();
 return <><NewsRetentionForm policy={d.policy} ready={d.ready&&Boolean(d.policy.prospective_from)}/>{d.counts&&<p>Automáticas activas: {d.counts.active} · Vencidas: {d.counts.expired} · Pendientes de eliminación: {d.counts.pending} · Permanentes: {d.counts.permanent} · Anteriores sin vencimiento: {d.counts.legacy}</p>}
 {d.ready&&<details><summary>Informes de limpieza</summary>{d.runs.length?<div className="table-scroll"><table><thead><tr><th>Fecha (Uruguay)</th><th>Vencidas</th><th>Eliminadas</th><th>Imágenes</th><th>Errores</th><th>Detalle</th></tr></thead><tbody>{d.runs.map(r=><tr key={r.id}><td>{new Date(r.started_at).toLocaleString('es-UY',{timeZone:'America/Montevideo'})}</td><td>{r.expired}</td><td>{r.removed}</td><td>{r.images_removed}</td><td>{r.errors}</td><td>{r.summary||(!r.finished_at?'En curso o interrumpida':'Completada')}</td></tr>)}</tbody></table></div>:<p>Sin ejecuciones de limpieza.</p>}</details>}</>;
}
