import Link from 'next/link';
import { requireOperations } from '@/lib/auth/operations';
import { advertisingData, topAdSlots } from '@/server/services/ads';
import { ctr } from '@/lib/admin/policy.mjs';
import { SlotForm, CreateTopSlot } from '@/components/admin/ad-form';
import { BannerGallery } from '@/components/admin/simple-banner-form';
import styles from './advertising.module.css';

export default async function Page() {
  await requireOperations();
  const d = await advertisingData(), now = d.now;
  const date = (value: string | null) => value ? new Date(value).toLocaleString('es-UY', { timeZone: d.timezone }) : 'Sin fin';
  const available = (campaign: typeof d.campaigns[number]) => campaign.active && new Date(campaign.start_at).getTime() <= now && (!campaign.end_at || new Date(campaign.end_at).getTime() > now);
  return <>
    <h1>Publicidad</h1>
    <Link className="button" href="/admin/publicidade/nova">Cargar banner</Link>
    <section className={styles.section} aria-labelledby="top-banners-heading">
      <h2 id="top-banners-heading">Banners del inicio</h2>
      <p>El carrusel aparece debajo de las cotizaciones y antes de las noticias. Sin banners activos, no se reserva un espacio vacío.</p>
      <div className={styles.positions}>{topAdSlots.map((position, index) => {
        const slot = d.slots.find(item => item.code === position.code);
        const campaigns = d.campaigns.filter(item => item.slot_id === slot?.id).sort((a,b)=>b.priority-a.priority||new Date(a.start_at).getTime()-new Date(b.start_at).getTime()||a.id.localeCompare(b.id));
        const eligible = slot?.active ? campaigns.filter(available).length : 0;
        return <article className={styles.position} key={position.code}>
          <h3>{index === 0 ? 'Carrusel superior · 70%' : 'Publicidad lateral · 30%'}</h3>
          <p>{index === 0 ? 'Artes recomendadas: 850 × 120 px. Versión móvil: 400 × 100 px. Rotación cada 6 segundos.' : 'Arte recomendada: 350 × 120 px. En celular aparece debajo del carrusel.'}</p>
          {!slot ? <><p>La posición todavía no está configurada.</p><CreateTopSlot code={position.code} name={position.name}/></> : <>
            <p className={styles.status}>{!slot.active ? 'Posición desactivada' : !campaigns.length ? 'Sin banners cargados' : eligible ? eligible + ' campaña(s) disponible(s) ahora' : 'Sin campañas activas en este horario'}</p>
            <p>{!slot.active ? 'Activá la posición en Espacios publicitarios para habilitar sus campañas.' : !campaigns.length ? 'Elegí una imagen y guardá. Se publica activa, sin enlace ni vencimiento.' : campaigns.length + ' banner(s). Activá, sustituí, eliminá u ordená desde las miniaturas.'}</p>
            <Link className="button secondary" href={'/admin/publicidade/nova?position=' + position.code}>{index === 0 ? 'Cargar banner del carrusel' : 'Cargar anuncio lateral'}</Link>
          </>}
        {campaigns.length > 0 && <BannerGallery banners={campaigns}/>}
        </article>;
      })}</div>
      <p>Usá las flechas para ordenar los banners. Los cambios se reflejan automáticamente en el inicio.</p>
      <Link href="/" target="_blank" rel="noopener noreferrer">Ver inicio ↗</Link>
    </section>
    <details><summary>Campañas y configuración avanzada</summary><h2>Campañas</h2>
    <div className="table-scroll"><table><thead><tr>{['Nombre', 'Anunciante', 'Posición', 'Estado', 'Inicio', 'Fin', 'Prioridad', 'Impresiones', 'Clics', 'CTR', 'Acciones'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>
      {d.campaigns.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.advertiser_name}</td><td>{c.slot_name}</td><td>{!c.active ? 'Pausada' : !d.slots.find(s => s.id === c.slot_id)?.active ? 'Posición inactiva' : new Date(c.start_at).getTime() > now ? 'Programada' : c.end_at && new Date(c.end_at).getTime() <= now ? 'Finalizada' : 'Activa'}</td><td>{date(c.start_at)}</td><td>{date(c.end_at)}</td><td>{c.priority}</td><td>{c.impressions}</td><td>{c.clicks}</td><td>{ctr(c.clicks, c.impressions).toFixed(2)}%</td><td><Link href={'/admin/publicidade/' + c.id}>Editar</Link></td></tr>)}
    </tbody></table></div>
    {!d.campaigns.length && <p>No hay campañas registradas. Cargá el primer banner desde las opciones de arriba.</p>}
    <h2>Espacios publicitarios</h2><p>Desactivar una posición suspende todas sus campañas.</p>
    {d.slots.map(slot => <SlotForm key={slot.id} slot={slot}/>)}
    </details>
  </>;
}
