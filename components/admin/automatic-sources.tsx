import Image from 'next/image';
import Link from 'next/link';
import {portalResources} from '@/server/services/portal-resources';
import {automationData} from '@/server/services/source-automation';
import {taxonomyList} from '@/server/repositories/editorial';
import {initialSources} from '@/lib/editorial/source-sync.mjs';
import {ResourceForm} from './resource-form';
import {SourceControls} from './source-controls';
import styles from './automatic-sources.module.css';
import {retentionPolicy} from '@/server/services/news-lifecycle';
import {NewsRetentionSummary} from './news-retention-summary';

export async function AutomaticSources(){
 const [sources,partners,automation,categories]=await Promise.all([portalResources('source',true),portalResources('partner',true),automationData(),taxonomyList('categories')]);
 const retention=await retentionPolicy();
 const resources=[...sources.items,...partners.items];
 const same=(a:string,b:string)=>a.replace(/\/$/,'')===b.replace(/\/$/,'');
 const entries=[...initialSources.map(preset=>({preset,item:resources.find(r=>same(r.url,preset.url))})),...resources.filter(r=>!initialSources.some(p=>same(r.url,p.url))&&(r.kind==='source'||automation.items.some(a=>a.resource_id===r.id))).map(item=>({preset:undefined,item}))];
 const date=(value:Date|null|undefined)=>value?new Intl.DateTimeFormat('es-UY',{dateStyle:'short',timeStyle:'short',timeZone:'America/Montevideo'}).format(new Date(value)):'Sin sincronizaciones';
 return <section id="fuentes-automaticas" className={styles.section} aria-label="Fuentes automáticas">
  <p className={styles.intro}>Consultá y administrá las fuentes de noticias. Registrar una fuente externa no implica una asociación formal.</p>
  <NewsRetentionSummary/>
  {!automation.ready&&<div className={styles.notice} role="status"><strong>La automatización requiere activar la base de datos.</strong><p>La migración 010 está pendiente. Podés registrar las fuentes y editar sus datos; sincronizar y programar requieren esa activación. No se ejecutará ninguna migración desde este panel.</p></div>}
  <div className={styles.toolbar}><SourceControls/><Link href="/admin/noticias?status=DRAFT">Revisar noticias importadas →</Link></div>
  <div className={styles.grid}>{entries.map(({preset,item})=>{
   const sync=automation.items.find(a=>a.resource_id===item?.id),name=item?.name||preset?.name||'',url=item?.url||preset?.url||'';
   const category=categories.find(c=>c.slug===(item?.category_slug||preset?.category))?.name||({mundo:'Mundo',uruguay:'Uruguay',tecnologia:'Tecnología'} as Record<string,string>)[preset?.category||'']||'Sin categoría';
   return <article key={item?.id||url} className={styles.card} data-automatic-source={preset?.url||url}>
    {item?.image_url&&<Image src={item.image_url} width={120} height={40} alt=""/>}
    <span className={styles.badge}>{item?'Registrada':'Pendiente de registro'}</span><h3>{name}</h3>
    <a className={styles.site} href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname} ↗</a>
    <dl className={styles.facts}>
     <div><dt>Estado de la fuente</dt><dd>{item?.active?'Activa':'Inactiva'}</dd></div>
     <div><dt>Categoría de destino</dt><dd>{category}</dd></div>
     <div><dt>Automatización</dt><dd>{!automation.ready?'Pendiente de activación':sync?.enabled&&item?.active?'Activada':'Desactivada'}</dd></div>
     <div><dt>Frecuencia</dt><dd>Cada {Math.max(sync?.interval_minutes||60,retention.policy.min_sync_minutes)} minutos</dd></div>
     <div><dt>Última sincronización</dt><dd>{date(sync?.last_sync_at)}</dd></div>
     <div><dt>Estado de la última consulta</dt><dd>{({ok:'Correcta',partial:'Parcial',error:'Error',pending:'Pendiente',interrupted:'Interrumpida'} as Record<string,string>)[sync?.last_status||'pending']||'Pendiente'}</dd></div>
     <div><dt>Noticias encontradas (última consulta)</dt><dd>{sync?.last_sync_at?(sync.last_found_count??0):'Sin consultas'}</dd></div>
     <div><dt>Importadas / duplicadas omitidas</dt><dd>{sync?.imported_count||0} / {sync?.duplicate_count||0}</dd></div>
    </dl>
    {sync?.last_error&&<p className={styles.hint} role="status">{sync.last_error}</p>}
    <div className={styles.actions}>
     {item?<SourceControls id={item.id} disabled={!automation.ready||!sync||!item.active}/>:<><SourceControls preset={preset?.url}/><button className="button secondary" disabled>Sincronizar ahora</button></>}
     {item?<details><summary>Editar configuración</summary><ResourceForm kind={item.kind} item={item} automation={sync} automationReady={automation.ready} categories={categories}/></details>:<p className={styles.hint}>Registrá la fuente con un clic para editar su configuración.</p>}
    </div>
   </article>;
  })}</div>
 </section>;
}
