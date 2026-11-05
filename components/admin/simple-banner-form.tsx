'use client';
/* eslint-disable @next/next/no-img-element -- normalized first-party banner previews */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ImageUpload } from '@/components/editorial/image-upload';
import { simpleBannerAction, manageBannerAction } from '@/app/admin/operations-actions';
import type { Campaign } from '@/server/services/ads';
import styles from './simple-banners.module.css';

export function SimpleBannerForm({ record, position = 'HOME_TOP' }: { record?: Campaign; position?: string }) {
  const [image, setImage] = useState(record?.image_url || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  return <form className={styles.form} aria-label="Guardar banner" onSubmit={async event => {
    event.preventDefault(); setSaving(true); setError('');
    const result = await simpleBannerAction(new FormData(event.currentTarget));
    setSaving(false);
    if (result.error) setError(result.error);
    else { router.push('/admin/publicidade'); router.refresh(); }
  }}>
    {record && <input type="hidden" name="id" value={record.id}/>}
    <input type="hidden" name="position" value={position}/><input type="hidden" name="image_url" value={image}/>
    <ImageUpload label="Imagen del banner" value={image} onChange={setImage} endpoint="/api/ads/upload" onBusyChange={setUploading}/>
    {error && <p role="alert">{error}</p>}
    <button className="button" type="submit" disabled={!image || uploading || saving}>{saving ? 'Guardando…' : 'Guardar banner'}</button>
  </form>;
}

export function BannerGallery({ banners }: { banners: Campaign[] }) {
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [removed, setRemoved] = useState<string[]>([]);
  const router = useRouter();
  async function operate(id: string, operation: string) {
    setBusy(id); setError('');
    const form = new FormData(); form.set('id', id); form.set('operation', operation);
    const result = await manageBannerAction(form); setBusy('');
    if (result.error) setError(result.error); else { if (operation === 'delete') setRemoved(current => [...current, id]); router.refresh(); }
  }
  return <>{error && <p role="alert">{error}</p>}<div className={styles.gallery}>{banners.filter(banner => !removed.includes(banner.id)).map((banner, index) => <article key={banner.id} className={styles.banner} data-banner-id={banner.id}>
    <img src={banner.image_url} alt={banner.alt_text}/>
    <p>{banner.active ? 'Activo' : 'Inactivo'}</p>
    <div className={styles.actions}>
      <Link href={'/admin/publicidade/' + banner.id}>Sustituir imagen</Link>
      <button type="button" disabled={!!busy} onClick={() => operate(banner.id, 'toggle')}>{banner.active ? 'Desactivar' : 'Activar'}</button>
      <button type="button" disabled={!!busy || index === 0} aria-label="Mover banner arriba" onClick={() => operate(banner.id, 'up')}>↑</button>
      <button type="button" disabled={!!busy || index === banners.length - 1} aria-label="Mover banner abajo" onClick={() => operate(banner.id, 'down')}>↓</button>
      <button type="button" disabled={!!busy} onClick={() => operate(banner.id, 'delete')}>Eliminar</button>
    </div>
  </article>)}</div></>;
}
