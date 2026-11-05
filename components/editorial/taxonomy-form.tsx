'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { taxonomyAction } from '@/app/admin/editorial-actions';
import { slugify } from '@/lib/editorial/shared';
import type { Taxonomy, TaxonomyKind } from '@/lib/editorial/types';
import { ImageUpload } from './image-upload';
export function TaxonomyForm({ kind, item }: { kind: TaxonomyKind; item?: Taxonomy }) {
  const router = useRouter();
  const [name,setName] = useState(item?.name || '');
  const [slug,setSlug] = useState(item?.slug || '');
  const [slugEdited,setSlugEdited] = useState(Boolean(item));
  const [photo,setPhoto] = useState(item?.photo_url || '');
  const [error,setError] = useState('');
  const [pending,startTransition] = useTransition();
  const [uploading,setUploading] = useState(false);
  const base = kind === 'categories' ? '/admin/categorias' : '/admin/autores';
  function submit(form: FormData) {
    setError('');
    startTransition(async () => {
      const result = await taxonomyAction(kind,form);
      if (result.error) setError(result.error);
      else { router.push(`${base}?salvo=1`); router.refresh(); }
    });
  }
  return <form className="editorial-form" onSubmit={event => { event.preventDefault(); if (uploading) { setError('Esperá a que termine de subir la foto.'); return; } submit(new FormData(event.currentTarget)); }}>
    <input type="hidden" name="id" value={item?.id || ''} />
    <label>Nombre *<input name="name" value={name} required maxLength={120} onChange={event => { setName(event.target.value); if (!slugEdited) setSlug(slugify(event.target.value)); }} /></label>
    <label>Slug *<input name="slug" required maxLength={180} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={event => { setSlugEdited(true); setSlug(event.target.value); }} /></label>
    <label>{kind === 'categories' ? 'Descripción' : 'Biografía'}<textarea aria-label={kind === 'categories' ? 'Descripción' : 'Biografía'} name={kind === 'categories' ? 'description' : 'bio'} defaultValue={item?.description || item?.bio || ''} maxLength={4000} rows={5} /></label>
    {kind === 'authors' && <><ImageUpload label="Foto del autor" value={photo} onChange={setPhoto} onBusyChange={setUploading} /><input type="hidden" name="photo_url" value={photo} /></>}
    <label className="check-label"><input type="checkbox" name="active" defaultChecked={item?.active ?? true} /> Activo</label>
    <p className="muted">Los registros inactivos no se pueden elegir para nuevas noticias. Se conservan los vínculos existentes.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="button" disabled={pending || uploading}>{pending ? 'Guardando…' : uploading ? 'Subiendo foto…' : 'Guardar'}</button>
      {item && <button type="button" className="button danger" disabled={pending} onClick={() => {
        if (window.confirm('¿Eliminar este registro? Si tiene noticias vinculadas, se impedirá la eliminación.')) {
          const data = new FormData(); data.set('id',item.id); data.set('intent','delete'); submit(data);
        }
      }}>Eliminar</button>}
    </div>
  </form>;
}
