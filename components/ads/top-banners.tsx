'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdCreative, type AdDelivery } from './creative';
import styles from './top-banners.module.css';
import { useRadio } from '@/components/radio/radio-player';
import { RadioStationCard } from '@/components/radio/radio-station-card';
type Inventory = { slides: AdDelivery[]; advertisement: AdDelivery | null };
export function TopBanners() {
  const { stations } = useRadio();
  const liveRadio = stations.find(station => station.website.replace(/\/$/, '') === 'https://www.radiomixartigas.com' || station.name === 'Radio Mix Artigas');
  const [inventory, setInventory] = useState<Inventory>({ slides: [], advertisement: null });
  const [index, setIndex] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [hidden, setHidden] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    change(); visibility();
    media.addEventListener('change', change); document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', change); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let running = false;
    async function load() {
      if (running || controller.signal.aborted) return;
      clearTimeout(timer);
      running = true;
      if (!document.hidden) try {
        const response = await fetch('/api/ads/top' + (liveRadio ? '?carouselOnly=1' : ''), { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!controller.signal.aborted) setInventory({ slides: Array.isArray(result?.slides) ? result.slides : [], advertisement: result?.advertisement || null });
      } catch { /* Keep valid, scheduled creatives until their own expiry. */ }
      running = false;
      if (!controller.signal.aborted) timer = setTimeout(load, 60000);
    }
    const resume = () => { if (!document.hidden) void load(); };
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    void load();
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  }, [pathname, liveRadio]);
  const count = inventory.slides.length;
  const selected = count ? index % count : 0;
  const paused = interacted || hover || focus || reduced || hidden;
  useEffect(() => {
    if (count < 2 || paused) return;
    const timer = setInterval(() => setIndex(current => (current + 1) % count), 6000);
    return () => clearInterval(timer);
  }, [count, paused]);
  function move(next: number) { setInteracted(true); setIndex((next + count) % count); }
  const remove = (receipt: string) => setInventory(current => ({ ...current, slides: current.slides.filter(slide => slide.receipt !== receipt) }));
  if (!count && !inventory.advertisement && !liveRadio) return null;
  return <section className={styles.top} aria-label={liveRadio ? 'Banners y radio en vivo' : 'Banners y publicidad'} data-top-banners>
    {!!count && <div className={styles.carousel} role="region" aria-roledescription="carrusel" aria-label="Banners destacados" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocusCapture={() => setFocus(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocus(false); }}>
      {inventory.slides.map((ad, position) => <div key={ad.receipt} className={`${styles.slide} ${position === selected ? styles.active : ''}`} role="group" aria-roledescription="diapositiva" aria-label={`${position + 1} de ${count}`} aria-hidden={position !== selected} onClick={() => setInteracted(true)}>
        <AdCreative ad={ad} active={position === selected} onUnavailable={() => remove(ad.receipt)} className={styles.creative} mobileBreakpoint={640}/>
        {ad.credit && <a className={styles.photoCredit} href={ad.credit.source} target="_blank" rel="noopener noreferrer" tabIndex={position === selected ? 0 : -1} title="Fotografía recortada para el banner; fuente y licencia">{ad.credit.author} · {ad.credit.license} · recorte</a>}
      </div>)}
      {count > 1 && <>
        <button type="button" className={`${styles.arrow} ${styles.previous}`} onClick={() => move(selected - 1)} aria-label="Banner anterior">‹</button>
        <button type="button" className={`${styles.arrow} ${styles.next}`} onClick={() => move(selected + 1)} aria-label="Banner siguiente">›</button>
        <div className={styles.controls}>
          {inventory.slides.map((ad, position) => <button type="button" key={ad.id} className={styles.dot} aria-label={`Ver banner ${position + 1}`} aria-current={position === selected ? 'true' : undefined} onClick={() => move(position)}><span/></button>)}
          <button type="button" className={styles.play} onClick={() => setInteracted(!interacted)} aria-label={interacted ? 'Reanudar banners' : 'Pausar banners'} aria-pressed={interacted}>{interacted ? '▶' : 'Ⅱ'}</button>
        </div>
      </>}
    </div>}
    {liveRadio ? <aside className={styles.radioSpot} aria-label="Radio en vivo"><RadioStationCard station={liveRadio} compact/></aside> : inventory.advertisement && <aside className={styles.advertisement} aria-label="Publicidad">
      <small>Publicidad</small><AdCreative ad={inventory.advertisement} className={styles.creative} onUnavailable={() => setInventory(current => ({ ...current, advertisement: null }))} mobileBreakpoint={640}/>
    </aside>}
  </section>;
}
