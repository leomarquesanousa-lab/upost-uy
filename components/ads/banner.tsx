'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdCreative, type AdDelivery } from './creative';
export function AdBanner({ position }: { position: string }) {
  const [ad, setAd] = useState<AdDelivery | null>(null);
  const pathname = usePathname();
  const unavailable = useCallback(() => setAd(null), []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function load() {
      if (!document.hidden) try {
        const response = await fetch('/api/ads/serve?slot=' + encodeURIComponent(position), { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!controller.signal.aborted) setAd(result);
      } catch { if (!controller.signal.aborted) setAd(null); }
      if (!controller.signal.aborted) timer = setTimeout(load, 60000);
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [position, pathname]);
  if (!ad) return null;
  return <aside className="ad-banner" aria-label="Publicidad" data-slot={position}><small>PUBLICIDAD</small><AdCreative ad={ad} onUnavailable={unavailable}/></aside>;
}
