'use client';
import { useCallback, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { newsAction } from '@/app/admin/editorial-actions';
import {previewBody} from '@/app/admin/editorial-actions';
import { slugify, statuses, statusLabels } from '@/lib/editorial/shared';
import type { News, Taxonomy } from '@/lib/editorial/types';
import type { ImportedArticle } from '@/lib/editorial/import-types';
import {montevideoInput,montevideoInstant} from '@/lib/editorial/time.mjs';
import { MarkdownEditor } from './markdown-editor';
import { ImageUpload } from './image-upload';
function utcInput(date: Date | string | null | undefined) { return montevideoInput(date); }
export function NewsForm({ item, imported, authors, categories, importPending = false }: { item?: News; imported?:ImportedArticle; authors: Taxonomy[]; categories: Taxonomy[]; importPending?: boolean }) {
  const router = useRouter();
  const matchingAuthors = imported?.original_author ? authors.filter(author => author.active && author.name.trim().toLocaleLowerCase('es-UY') === imported.original_author.trim().toLocaleLowerCase('es-UY')) : [];
  const importedAuthorId = matchingAuthors.length === 1 ? matchingAuthors[0].id : '';
  const [title,setTitle] = useState(item?.title || imported?.title || '');
  const [slug,setSlug] = useState(item?.slug || slugify(imported?.title || ''));
  const [slugEdited,setSlugEdited] = useState(Boolean(item));
  const [body,setBody] = useState(item?.body || imported?.body || '');
  const [cover,setCover] = useState(item?.cover_image || imported?.cover_image || '');
  const activeUploads = useRef(0);
  const [uploadsPending,setUploadsPending] = useState(0);
  const onUploadBusyChange = useCallback((busy: boolean) => {
    activeUploads.current = Math.max(0, activeUploads.current + (busy ? 1 : -1));
    setUploadsPending(activeUploads.current);
  }, []);
  const [status,setStatus] = useState(item?.status || 'DRAFT');
  const [error,setError] = useState('');
  const [pending,startTransition] = useTransition();
  const dialog=useRef<HTMLDialogElement>(null);
  const [preview,setPreview]=useState<{title:string;subtitle:string;author:string;html:string}>({title:'',subtitle:'',author:'',html:''});
  return <form className="editorial-form news-form" onSubmit={event => {
    event.preventDefault();
    if (activeUploads.current || importPending) { setError('Esperá a que terminen de subir las imágenes.'); return; }
    const data = new FormData(event.currentTarget);
    try { for (const field of ['published_at','scheduled_at']) {
      const date = String(data.get(field) || '');
      data.set(field, date ? montevideoInstant(date) : '');
    } } catch {setError('Fecha inválida. Revisá la fecha y la hora.');return;}
    setError('');
    startTransition(async () => {
      const result = await newsAction(data);
      if (result.error) setError(result.error);
      else { router.push('/admin/noticias?salvo=1'); router.refresh(); }
    });
  }}>
    <input type="hidden" name="id" value={item?.id || ''} /><input type="hidden" name="version" value={item?.version || ''} />
    {imported && <aside className="import-origin"><input type="hidden" name="imported" value="1" /><h2>Artículo importado</h2><p>{imported.source_name || 'Fuente sin nombre identificado'}</p><a href={imported.source_url} target="_blank" rel="noopener noreferrer">Consultar artículo original ↗</a>{imported.original_author && <p>Autoría en la fuente: {imported.original_author}. Revisá el autor editorial.</p>}{imported.original_published_at && <p>Publicación original: {new Date(imported.original_published_at).toLocaleString('es-UY',{timeZone:'America/Montevideo'})} (Uruguay). Revisá la fecha antes de guardar.</p>}{!imported.body && <p>Completá el texto del artículo antes de publicar.</p>}{imported.external_image_url && <p>Imagen importada. <a href={imported.external_image_url} target="_blank" rel="noopener noreferrer">Consultar referencia externa ↗</a>. Podés cambiarla en el editor.</p>}</aside>}
    {imported?.warnings?.map((warning,index)=><p className="import-warning" role="status" key={index}>{warning}</p>)}
    <fieldset><legend>Artículo</legend>
      <label>Título *<input name="title" required maxLength={240} value={title} onChange={event => { setTitle(event.target.value); if (!slugEdited) setSlug(slugify(event.target.value)); }} /></label>
      <label>Slug *<input name="slug" required maxLength={180} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={event => { setSlugEdited(true); setSlug(event.target.value); }} /></label>
      {item && <small>Cambiar el slug modifica la URL pública. Los enlaces anteriores dejarán de funcionar.</small>}
      <label>Subtítulo<textarea aria-label="Subtítulo" name="subtitle" maxLength={400} rows={2} defaultValue={item?.subtitle || imported?.subtitle} /></label>
      <label>Resumen<textarea aria-label="Resumen" name="excerpt" maxLength={600} rows={3} defaultValue={item?.excerpt || imported?.excerpt} /></label>
      <MarkdownEditor value={body} onChange={setBody} onUploadBusyChange={onUploadBusyChange} />
    </fieldset>
    <fieldset><legend>Autoría y categorías</legend>
      <label>Autor *<select aria-label="Autor *" name="author_id" required defaultValue={item?.author_id || importedAuthorId}><option value="">Seleccioná</option>{authors.filter(author => author.active || author.id === item?.author_id).map(author => <option key={author.id} value={author.id}>{author.name}{!author.active && ' (inactivo)'}</option>)}</select></label>
      <div><p>Categorías * <small>Seleccioná al menos una.</small></p><div className="category-options">{categories.filter(category => category.active || item?.categories.some(c=>c.id===category.id)).map(category => <label className="check-label" key={category.id}><input name="category_ids" type="checkbox" value={category.id} defaultChecked={item?.categories.some(c=>c.id===category.id)} />{category.name}{!category.active && ' (inactiva)'}</label>)}</div></div>
      {(!authors.some(a=>a.active) || !categories.some(c=>c.active)) && <p className="form-error">Un administrador debe registrar un autor y una categoría activos antes de crear una noticia.</p>}
    </fieldset>
    <fieldset><legend>Imagen de portada</legend><ImageUpload label="Subir imagen de portada" value={cover} onChange={setCover} onBusyChange={onUploadBusyChange} /><input type="hidden" name="cover_image" value={cover} />
      <label>Texto alternativo {cover && '*'}<input name="cover_alt" required={Boolean(cover)} maxLength={300} defaultValue={item?.cover_alt || imported?.cover_alt} /></label>
      <label>Leyenda<input name="cover_caption" maxLength={500} defaultValue={item?.cover_caption || imported?.cover_caption} /></label>
      <label>Crédito<input name="cover_credit" maxLength={200} defaultValue={item?.cover_credit || imported?.cover_credit} /></label>
    </fieldset>
    <fieldset><legend>Publicación</legend>
      <label>Status<select aria-label="Status" name="status" value={status} onChange={event=>setStatus(event.target.value as typeof status)}>{statuses.map(value=><option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
      <p className="muted">Fechas de Uruguay (America/Montevideo). Sin fecha, se publica al guardar. Para una publicación futura, elegí Programada. Una fecha pasada se publica inmediatamente.</p>
      <label>Fecha de publicación (Uruguay)<input name="published_at" type="datetime-local" defaultValue={utcInput(item?.published_at || imported?.original_published_at)} /></label>
      <label>Programación (Uruguay)<input name="scheduled_at" type="datetime-local" required={status==='SCHEDULED'} defaultValue={utcInput(item?.scheduled_at)} /></label>
      <label className="check-label"><input name="featured" type="checkbox" defaultChecked={item?.featured} /> Destacar en portada</label>
      <label className="check-label"><input name="urgent" type="checkbox" defaultChecked={item?.urgent} /> Último momento (reemplaza el aviso anterior)</label>
      <p className="muted">Para retirar una noticia del portal, guardala como Archivada. Se conserva el historial.</p>
    </fieldset>
    <fieldset><legend>SEO</legend>
      <label>Título SEO<input name="seo_title" maxLength={120} defaultValue={item?.seo_title} /></label>
      <label>Descripción SEO<textarea aria-label="Descripción SEO" name="seo_description" maxLength={300} rows={3} defaultValue={item?.seo_description} /></label>
      <label>URL canónica<input name="canonical_url" type="url" maxLength={2048} defaultValue={item?.canonical_url || imported?.canonical_url} placeholder="Opcional: URL original del artículo" /></label>
      <small>Si se deja vacío, se usan el título, el resumen y la URL de la noticia.</small>
    </fieldset>
    <fieldset><legend>Fuente</legend><label>Nombre de la fuente<input name="source_name" maxLength={200} defaultValue={item?.source_name || imported?.source_name} /></label><label>URL original<input name="source_url" type="url" maxLength={2048} defaultValue={item?.source_url || imported?.source_url} /></label><small>El origen se puede editar y se muestra al publicar.</small></fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="button" disabled={pending || uploadsPending > 0 || importPending}>{pending ? 'Guardando…' : uploadsPending > 0 ? 'Subiendo imagen…' : 'Guardar noticia'}</button>
      <button type="button" className="button secondary" disabled={pending} onClick={event=>{
        const form=event.currentTarget.form;if(!form)return;const data=new FormData(form);
        startTransition(async()=>{const result=await previewBody(body);if(result.error){setError(result.error);return;}
          setPreview({title,subtitle:String(data.get('subtitle')||''),author:authors.find(a=>a.id===data.get('author_id'))?.name||'',html:result.html||''});
          dialog.current?.showModal();
        });
      }}>Vista previa del artículo</button>
    </div>
    <dialog className="article-preview-dialog" ref={dialog} aria-label="Vista previa editorial">
      <button type="button" className="button secondary" onClick={()=>dialog.current?.close()}>Cerrar vista previa</button>
      <article className="article-page"><p className="eyebrow">VISTA PREVIA · SIN PUBLICAR</p><h1>{preview.title}</h1><p className="article-subtitle">{preview.subtitle}</p><p className="byline">{preview.author}</p>
        <div className="article-body" dangerouslySetInnerHTML={{__html:preview.html}}/>
      </article>
    </dialog>
  </form>;
}
