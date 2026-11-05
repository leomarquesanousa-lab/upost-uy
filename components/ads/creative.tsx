'use client';
import { useEffect, useRef, useState } from 'react';
export type AdDelivery = { id: string; receipt: string; image: string; mobile: string; alt: string; end: string | null; linked?: boolean; credit?: { author: string; license: string; source: string } };
export function AdCreative({ ad, active = true, onUnavailable, className = '', mobileBreakpoint = 760 }: { ad: AdDelivery; active?: boolean; onUnavailable: () => void; className?: string; mobileBreakpoint?: number }) {
  const element = useRef<HTMLAnchorElement & HTMLDivElement>(null);
  const [loaded, setLoaded] = useState('');
  useEffect(() => {
    if (!ad.end) return;
    const timer = setTimeout(onUnavailable, Math.min(Math.max(0, new Date(ad.end).getTime() - Date.now()), 2147483647));
    return () => clearTimeout(timer);
  }, [ad.end, onUnavailable]);
  useEffect(() => {
    if (!active || loaded !== ad.receipt || !element.current) return;
    let visible = false, sent = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      if (visible && !document.hidden && !sent) timer = setTimeout(() => {
        sent = true;
        void fetch('/api/ads/impression', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ad.id, receipt: ad.receipt }), keepalive: true }).catch(() => {});
      }, 1000);
    };
    const observer = new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting && e.intersectionRatio >= .5); update(); }, { threshold: [0, .5] });
    observer.observe(element.current);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); clearTimeout(timer); document.removeEventListener('visibilitychange', update); };
  }, [ad.id, ad.receipt, active, loaded]);
  const picture = <picture>{ad.mobile && <source media={`(max-width: ${mobileBreakpoint}px)`} srcSet={ad.mobile}/>}<img src={ad.image} alt={ad.alt} onLoad={() => setLoaded(ad.receipt)} onError={onUnavailable}/></picture>;
  if (ad.linked === false) return <div ref={element} className={className}>{picture}</div>;
  return <a ref={element} className={className} href={`/api/ads/click/${ad.id}?receipt=${encodeURIComponent(ad.receipt)}`} target="_blank" rel="sponsored noopener noreferrer" tabIndex={active ? 0 : -1}>
    {picture}
  </a>;
}
