'use client';
import { useEffect, useState } from 'react';
import styles from './market-ticker.module.css';
type Indicator = { id: string; label: string; value: string; reference: string; asOf: string; sourceUrl: string };
export function MarketTicker() {
  const [items, setItems] = useState<Indicator[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      if (!document.hidden) {
        try {
          const response = await fetch('/api/market', { signal: controller.signal });
          const data = await response.json();
          if (!controller.signal.aborted) setItems(Array.isArray(data?.indicators) ? data.indicators : []);
        } catch { /* Keep existing dated references on a transient network failure. */ }
        if (!controller.signal.aborted) setLoading(false);
      }
      if (!controller.signal.aborted) timer = setTimeout(refresh, 600000);
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  return <section className={styles.ticker} aria-label="Cotizaciones e indicadores de Uruguay" data-market-ticker>
    <div className={`container ${styles.inner}`}>
      <span className={styles.label}>Mercados</span>
      <div className={styles.viewport}>
        {items.length ? <div className={`${styles.track} ${paused ? styles.paused : ''}`}>
          {[0, 1].map(copy => <div key={copy} className={styles.group} aria-hidden={copy === 1 ? true : undefined}>
            {items.map(item => <a key={item.id} href={item.sourceUrl} target="_blank" rel="noopener noreferrer" tabIndex={copy ? -1 : 0} title={`Referencia de la fuente: ${item.reference}. Datos periódicos, no en tiempo real.`}>
              <strong>{item.label}</strong><span>{item.value}</span><time dateTime={item.asOf}>Ref. {item.reference}</time>
            </a>)}
          </div>)}
        </div> : <span className={styles.unavailable}>{loading ? 'Consultando indicadores…' : 'Indicadores temporalmente no disponibles'}</span>}
      </div>
      <a className={styles.source} href="https://datosuruguay.com" target="_blank" rel="noopener noreferrer" title="Datos de datosUruguay.com · CC BY 4.0">datosUruguay ↗</a>
      {!!items.length && <button className={styles.pause} type="button" onClick={() => setPaused(!paused)} aria-label={paused ? 'Reanudar cotizaciones' : 'Pausar cotizaciones'} aria-pressed={paused}>{paused ? '▶' : 'Ⅱ'}</button>}
    </div>
  </section>;
}
