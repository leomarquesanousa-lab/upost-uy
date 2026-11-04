'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

type Banner = { src: string; alt: string };
const items: Banner[] = [
    { src: '/banner/banner1.PNG', alt: 'Biosfera Rádio TV Web: informação e música ao vivo no estúdio.' },
    { src: '/banner/banner2.PNG', alt: 'Apresentador ao microfone em um estúdio de rádio.' },

    { src: '/banner/banner3.PNG', alt: 'Bandeira do Maranhão e paisagens do estado ao pôr do sol.' },
    { src: '/banner/banner4.PNG', alt: 'Vista da orla e do patrimônio histórico de São Luís.' },
];

export function BannerRotation() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState<number[]>([]);
  const frame = useRef<HTMLDivElement>(null);
  const visible = useRef(false);
  const touchStart = useRef<{x:number;y:number}|null>(null);
  function move(direction:number) {
    setActive(current => { const next=(current+direction+items.length)%items.length; return ready.includes(next)?next:current; });
  }

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener('change', update);
    const observer = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; });
    if (frame.current) observer.observe(frame.current);
    return () => { media.removeEventListener('change', update); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (paused || hovered || focused || reducedMotion) return;
    const timer = setInterval(() => {
      if (document.hidden || !visible.current) return;
      setActive(current => ready.includes((current + 1) % items.length) ? (current + 1) % items.length : current);
    }, 7000);
    return () => clearInterval(timer);
  }, [paused, hovered, focused, reducedMotion, ready]);

  return <section className="home-banner" aria-label="Banners da Biosfera" aria-roledescription="carrossel"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
    <div ref={frame} className="home-banner-frame"
      onTouchStart={event => { const point=event.touches[0]; touchStart.current=event.touches.length===1?{x:point.clientX,y:point.clientY}:null; }}
      onTouchCancel={() => { touchStart.current=null; }}
      onTouchEnd={event => { const start=touchStart.current; touchStart.current=null; const end=event.changedTouches[0]; if(!start||!end)return; const dx=end.clientX-start.x,dy=end.clientY-start.y; if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1); }}>
      {items.map((item, index) => <div key={item.src} className={`home-banner-slide${active === index ? ' is-active' : ''}`} aria-hidden={active !== index}>
        <Image src={item.src} alt={item.alt} fill sizes="(max-width: 760px) calc(100vw - 36px), (max-width: 980px) calc(80vw - 58px), (max-width: 1320px) calc(80vw - 83px), 973px" onLoad={() => setReady(current => current.includes(index) ? current : [...current, index])}/>
      </div>)}
    </div>
    <div className="home-banner-controls">
      <button type="button" className="home-banner-arrow" aria-label="Banner anterior" disabled={!ready.includes((active-1+items.length)%items.length)} onClick={() => move(-1)}>‹</button>
      {items.map((_, index) => <button key={index} type="button" className="home-banner-indicator" aria-label={`Mostrar banner ${index + 1}`} aria-pressed={active === index} disabled={!ready.includes(index)} onClick={() => setActive(index)}><span/></button>)}
      <button type="button" className="home-banner-arrow" aria-label="Próximo banner" disabled={!ready.includes((active+1)%items.length)} onClick={() => move(1)}>›</button>
      {!reducedMotion && <button type="button" className="home-banner-pause" aria-label={paused ? 'Retomar rotação dos banners' : 'Pausar rotação dos banners'} onClick={() => setPaused(current => !current)}>{paused ? 'Retomar' : 'Pausar'}</button>}
    </div>
  </section>;
}
