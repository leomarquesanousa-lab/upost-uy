import Link from 'next/link';
import {requireOperations} from '@/lib/auth/operations';
import {portalResources,type ResourceKind} from '@/server/services/portal-resources';
import {ResourceForm} from '@/components/admin/resource-form';
import {automationData} from '@/server/services/source-automation';
import {taxonomyList} from '@/server/repositories/editorial';
import {AutomaticSources} from '@/components/admin/automatic-sources';
export const maxDuration=300;
export default async function NetworkPage(){
 await requireOperations();
 const [groups,automation,categories]=await Promise.all([
  Promise.all((['partner','radio'] as ResourceKind[]).map(async kind=>({kind,...await portalResources(kind,true)}))),
  automationData(),taxonomyList('categories')
 ]);
 const labels={partner:'Medios asociados',radio:'Radios en vivo',source:'Fuentes externas'};
 return <>
  <p className="eyebrow">UPOST.uy</p><h1>Medios asociados y red</h1>
  <p>Medios asociados: socios registrados. Fuentes externas: información con atribución, sin implicar una asociación formal.</p>
  <p><Link className="button" href="/admin/fuentes-automaticas">Fuentes automáticas →</Link></p>
  {!automation.ready&&<p role="status">La automatización requiere activar la base de datos. La migración 010 está pendiente; el registro de medios y radios sigue disponible.</p>}
  <h2>Fuentes automáticas</h2><AutomaticSources/>
  {groups.map(group=><section key={group.kind}>
   <h2>{labels[group.kind]}</h2>
   {!group.ready?<p className="empty-state">Disponible después de aplicar manualmente la migración 009.</p>:<>
    <details><summary>Agregar {labels[group.kind].toLowerCase()}</summary><ResourceForm categories={categories} kind={group.kind} automationReady={automation.ready}/></details>
    {group.items.map(item=><details key={item.id}>
     <summary>{item.name} · {item.active?'Activo':'Inactivo'}</summary>
     {group.kind!=='radio'&&<p><Link href="/admin/fuentes-automaticas">Ver sincronización y automatización →</Link></p>}
     <ResourceForm categories={categories} kind={group.kind} item={item} automation={automation.items.find(a=>a.resource_id===item.id)} automationReady={automation.ready}/>
    </details>)}
   </>}
  </section>)}
 </>;
}
