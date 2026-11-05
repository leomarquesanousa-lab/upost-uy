import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOperations } from '@/lib/auth/operations';
import { advertisingData } from '@/server/services/ads';
import { SimpleBannerForm } from '@/components/admin/simple-banner-form';
import { AdForm } from '@/components/admin/ad-form';
export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ position?: string }>;
}) {
  await requireOperations();
  const { id } = await params, query = await searchParams, d = await advertisingData();
  const record = id === 'nova' ? undefined : d.campaigns.find(c => c.id === id);
  if (id !== 'nova' && !record) notFound();
  const slot = d.slots.find(slot => slot.id === record?.slot_id || slot.code === query.position);
  const position = slot?.code === 'HOME_SIDEBAR' ? 'HOME_SIDEBAR' : 'HOME_TOP';
  const simple = !record || ['HOME_TOP', 'HOME_SIDEBAR'].includes(slot?.code || '');
  return <><Link href="/admin/publicidade">← Publicidad</Link><h1>{record ? 'Sustituir imagen' : position === 'HOME_TOP' ? 'Cargar banner del carrusel' : 'Cargar anuncio lateral'}</h1>
  {simple ? <SimpleBannerForm record={record} position={position}/> : <AdForm record={record} slots={d.slots} timezone={d.timezone}/>}
  {simple && record && <details><summary>Configuración avanzada (opcional)</summary><AdForm record={record} slots={d.slots} timezone={d.timezone}/></details>}</>;
}
