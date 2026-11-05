'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {saveResource} from '@/app/admin/resource-actions';
import type {PortalResource,ResourceKind} from '@/server/services/portal-resources';
import {ImageUpload} from '@/components/editorial/image-upload';
import type {Automation} from '@/server/services/source-automation';
export function ResourceForm({kind,item,automation,automationReady=false,categories=[]}:{kind:ResourceKind;item?:PortalResource;automation?:Automation;automationReady?:boolean;categories?:{slug:string;name:string}[]}){
 const [error,setError]=useState(''),[pending,start]=useTransition(),[busy,setBusy]=useState(false),[image,setImage]=useState(item?.image_url||'');const router=useRouter();
 return <form className="editorial-form" onSubmit={event=>{event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget);start(async()=>{const result=await saveResource(data);setError(result.error||'');if(result.ok)router.refresh();});}}>
 <input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={item?.id||''}/>
 <label>Nombre<input name="name" required maxLength={200} defaultValue={item?.name}/></label><label>URL<input type="url" name="url" required defaultValue={item?.url}/></label>
 <label>Descripción<textarea name="description" maxLength={4000} defaultValue={item?.description}/></label><label>Tipo de medio<input name="media_type" maxLength={100} defaultValue={item?.media_type}/></label>
 <ImageUpload label="Imagen o logotipo (opcional)" value={image} onChange={setImage} onBusyChange={setBusy}/><input type="hidden" name="image_url" value={image}/>
 {kind==='radio'&&<label>URL del audio en vivo (HTTPS)<input type="url" name="stream_url" placeholder="https://servidor.example/radio" defaultValue={item?.stream_url}/></label>}
 {kind!=='radio'&&<><label>RSS / Atom (opcional, detección automática)<input type="url" name="feed_url" defaultValue={item?.feed_url}/></label><label>Categoría de destino<select name="category_slug" defaultValue={item?.category_slug||''}><option value="">Seleccioná una categoría</option>{categories.map(c=><option value={c.slug} key={c.slug}>{c.name}</option>)}</select></label><p>Sin RSS se consulta la página pública de noticias indicada en URL. Las fuentes externas no se presentan como socios oficiales.</p>
 {automationReady&&<fieldset><legend>Automatización</legend><input type="hidden" name="automation_present" value="1"/>
 <label className="check-label"><input type="checkbox" name="automation_enabled" defaultChecked={automation?.enabled}/>Consultar automáticamente</label>
 <label>Frecuencia (minutos)<input type="number" name="interval_minutes" min={15} max={1440} defaultValue={automation?.interval_minutes||30}/></label>
 <label>Nuevas noticias por consulta<input type="number" name="max_items" min={1} max={10} defaultValue={automation?.max_items||3}/></label>
 <label>Publicación<select name="publication_mode" defaultValue={automation?.publication_mode||'review'}><option value="review">Revisión editorial (borradores)</option><option value="automatic">Publicación automática</option></select></label>
 <label>Contenido<select name="content_mode" defaultValue={automation?.content_mode||'summary'}><option value="summary">Resumen y enlace original</option><option value="full">Texto completo disponible</option></select></label>
 <details><summary>Filtro de temas (opcional)</summary><label>Palabras o temas separados por comas<input name="keywords" maxLength={1000} defaultValue={automation?.keywords}/></label></details>
 </fieldset>}</>}
 <label>Orden<input type="number" name="display_order" defaultValue={item?.display_order||0}/></label><label className="check-label"><input type="checkbox" name="active" defaultChecked={item?.active}/>Activo</label>
 {error&&<p role="alert" className="form-error">{error}</p>}<button className="button" disabled={pending||busy}>{pending?'Guardando…':'Guardar'}</button></form>;
}
