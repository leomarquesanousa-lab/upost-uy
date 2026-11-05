'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Slot } from '@/server/services/programming';
import type { RadioStation } from '@/server/services/portal-resources';
import styles from './radio-player.module.css';
export type RadioProgramming = { current: Slot | null; next: Slot[] };
type Status = 'paused' | 'loading' | 'playing' | 'error';
export const radioLabels = { paused: 'Lista para escuchar', loading: 'Conectando…', playing: 'Escuchando en vivo', error: 'No se pudo conectar. Intentá nuevamente.' };
type RadioState = { status: Status; volume: number; toggle: () => void; changeVolume: (value: number) => void; programming: RadioProgramming; station: RadioStation | null; stations: RadioStation[]; playStation: (station: RadioStation) => void };
const RadioContext = createContext<RadioState | null>(null);

export function RadioProvider({ streamUrl = '', stations = [], children, initialProgramming = { current: null, next: [] } }: {
  streamUrl?: string; stations?: RadioStation[]; children: React.ReactNode; initialProgramming?: RadioProgramming;
}) {
  const initial = stations[0] || (streamUrl ? { id: 'legacy', name: 'Radio en vivo', location: 'Uruguay', website: '', streamUrl, imageUrl: '' } : null);
  const [station, setStation] = useState<RadioStation | null>(initial);
  const selected = useRef<RadioStation | null>(initial);
  const audio = useRef<HTMLAudioElement>(null);
  const wanted = useRef(false), retries = useRef(0), generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<Status>('paused');
  const [volume, setVolume] = useState(.7);
  const programming = initialProgramming;
  const pathname = usePathname();
  const showBar = !!station && pathname !== '/';

  useEffect(() => {
    if (audio.current) audio.current.volume = .7;
    return () => { if (timer.current) clearTimeout(timer.current); if (watchdog.current) clearTimeout(watchdog.current); };
  }, []);
  function clearTimers() {
    if (timer.current) clearTimeout(timer.current);
    if (watchdog.current) clearTimeout(watchdog.current);
    timer.current = null; watchdog.current = null;
  }
  function failed() {
    if (!wanted.current || timer.current) return;
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
    if (retries.current >= 3) { wanted.current = false; audio.current?.pause(); setStatus('error'); return; }
    setStatus('loading');
    timer.current = setTimeout(() => { timer.current = null; start(); }, 2000 * 2 ** retries.current++);
  }
  function start() {
    const player = audio.current, current = selected.current;
    if (!player || !current || !wanted.current) return;
    const attempt = ++generation.current;
    clearTimers(); setStatus('loading');
    player.src = current.streamUrl;
    player.load();
    watchdog.current = setTimeout(failed, 15000);
    // Keep play() in the visitor's gesture; do not await a network request here.
    void player.play().catch((error: DOMException) => {
      if (!wanted.current || attempt !== generation.current || error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') { clearTimers(); wanted.current = false; setStatus('error'); }
      else failed();
    });
  }
  function pause() {
    wanted.current = false; generation.current++; clearTimers();
    audio.current?.pause();
    audio.current?.removeAttribute('src'); audio.current?.load();
    setStatus('paused');
  }
  function playStation(next: RadioStation) {
    if (selected.current?.id === next.id && wanted.current) { pause(); return; }
    try { const url = new URL(next.streamUrl); if (url.protocol !== 'https:' || url.username || url.password) return; } catch { return; }
    clearTimers(); selected.current = next; setStation(next);
    wanted.current = true; retries.current = 0; start();
  }
  function toggle() { if (wanted.current) pause(); else if (selected.current) playStation(selected.current); }
  function changeVolume(value: number) {
    if (!Number.isFinite(value)) return;
    const next = Math.min(1, Math.max(0, value));
    setVolume(next); if (audio.current) audio.current.volume = next;
  }
  return <RadioContext.Provider value={{ status, volume, toggle, changeVolume, programming, station, stations, playStation }}>
    <div className={showBar ? styles.pageWithPlayer : undefined}>{children}</div>
    <audio ref={audio} data-radio-audio preload="none"
      onPlaying={() => { if (wanted.current) { clearTimers(); retries.current = 0; setStatus('playing'); } }}
      onError={failed} onEnded={failed} onWaiting={() => { if (wanted.current) { setStatus('loading'); if (!watchdog.current) watchdog.current = setTimeout(failed, 15000); } }}/>
    {showBar && <RadioPlayer/>}
  </RadioContext.Provider>;
}
export function useRadio() {
  const radio = useContext(RadioContext);
  if (!radio) throw new Error('Player fuera del proveedor.');
  return radio;
}
export function useRadioProgramming() { return useRadio().programming; }
export function HeaderListen() {
  const { status, toggle } = useRadio(); const active = status === 'playing' || status === 'loading';
  return <button type="button" className="header-listen" onClick={toggle} aria-label={active ? 'Pausar radio' : 'Escuchar radio'}>{active ? 'Ⅱ Pausar' : '▶ Escuchar'}</button>;
}
function RadioPlayer() {
  const { station, status, volume, toggle, changeVolume } = useRadio();
  if (!station) return null;
  const active = status === 'playing' || status === 'loading';
  return <section className={styles.bar} aria-label="Player de radio en vivo" data-radio-player>
    <div className={styles.barInner}>
      <div className={styles.identity}>
        {/* eslint-disable-next-line @next/next/no-img-element -- registered local station logo */}
        {station.imageUrl ? <img src={station.imageUrl} alt="" width={40} height={40}/> : <span className={styles.symbol} aria-hidden="true">♪</span>}
        <div><strong>{station.name}</strong><span>{station.location}</span><small role="status">{radioLabels[status]}</small></div>
      </div>
      <button className={styles.play} type="button" onClick={toggle} aria-label={active ? 'Pausar radio' : 'Escuchar radio'} aria-pressed={active}>{active ? 'Ⅱ' : '▶'}</button>
      <label className={styles.volume}>Volumen<input aria-label="Volumen de la radio" type="range" min="0" max="1" step=".01" value={volume} onChange={event => changeVolume(Number(event.target.value))}/></label>
    </div>
  </section>;
}
export function HomeRadio({ siteName, nowPlaying }: { siteName: string; nowPlaying?: { name: string; presenters: string } }) {
  const { status, toggle } = useRadio();
  return <section className={styles.card}><h2>{siteName}</h2>{nowPlaying && <p>{nowPlaying.name} · {nowPlaying.presenters}</p>}<button type="button" onClick={toggle}>{status === 'playing' || status === 'loading' ? 'Pausar' : 'Escuchar en vivo'}</button><p role="status">{radioLabels[status]}</p></section>;
}
