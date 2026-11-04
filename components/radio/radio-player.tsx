'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { RadioWave } from './radio-wave';
import { LiveBadge } from '@/components/live-badge';
import type { Slot } from '@/server/services/programming';
export type RadioProgramming={current:Slot|null;next:Slot[]};
type Status = 'paused' | 'loading' | 'playing' | 'error';
const labels = { paused: 'Pronta para ouvir', loading: 'Conectando à rádio…', playing: 'Você está ouvindo ao vivo', error: 'Não foi possível conectar. Tente novamente.' };
const RadioContext=createContext<{status:Status;volume:number;toggle:()=>void;changeVolume:(value:number)=>void;programming:RadioProgramming}|null>(null);
export function RadioProvider({ streamUrl, children, initialProgramming }: { streamUrl: string; children:React.ReactNode; initialProgramming:RadioProgramming }) {
  const audio = useRef<HTMLAudioElement>(null);
  const wanted = useRef(false);
  const retries = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<Status>('paused');
  const [volume, setVolume] = useState(0.7);
  const [programming,setProgramming]=useState(initialProgramming);
  useEffect(()=>{let stopped=false;let poll:ReturnType<typeof setTimeout>;const controller=new AbortController();async function tick(){if(!document.hidden)try{const response=await fetch('/api/programacao',{signal:controller.signal});if(response.ok&&!stopped)setProgramming(await response.json());}catch{}if(!stopped)poll=setTimeout(tick,30000);}poll=setTimeout(tick,30000);return ()=>{stopped=true;controller.abort();clearTimeout(poll);};},[]);
  useEffect(() => {
    if (audio.current) audio.current.volume = 0.7;
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
    if (retries.current >= 3) {
      wanted.current = false; audio.current?.pause(); setStatus('error'); return;
    }
    setStatus('loading');
    const delay = 2000 * 2 ** retries.current++;
    timer.current = setTimeout(() => { timer.current = null; start(); }, delay);
  }
  function start() {
    if (!audio.current || !wanted.current) return;
    setStatus('loading');
    audio.current.load();
    watchdog.current = setTimeout(failed, 15000);
    void audio.current.play().catch((error: DOMException) => {
      if (!wanted.current || error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') { clearTimers(); wanted.current = false; setStatus('error'); }
      else failed();
    });
  }
  function toggle() {
    if (wanted.current) {
      wanted.current = false; clearTimers(); audio.current?.pause(); setStatus('paused');
    } else { wanted.current = true; retries.current = 0; start(); }
  }
  function changeVolume(value:number) { setVolume(value);if(audio.current)audio.current.volume=value; }
  return <RadioContext.Provider value={{status,volume,toggle,changeVolume,programming}}>{children}
    <audio ref={audio} src={streamUrl} preload="none" onPlaying={() => { clearTimers(); setStatus('playing'); }} onError={failed} onEnded={failed} onWaiting={() => { if (wanted.current) { setStatus('loading'); if (!watchdog.current) watchdog.current = setTimeout(failed, 15000); } }} />
    <RadioPlayer />
  </RadioContext.Provider>;
}
function useRadio() {
  const radio=useContext(RadioContext);
  if(!radio)throw new Error('Player fora do provedor.');
  return radio;
}
export function useRadioProgramming(){return useRadio().programming;}
export function HeaderListen(){const {status,toggle}=useRadio();const active=status==='playing'||status==='loading';return <button type="button" className="header-listen" onClick={toggle} aria-label={active?'Pausar ao vivo':'Ouça ao vivo'}><span aria-hidden="true">{active?'Ⅱ':'▶'}</span><span>{active?'Pausar':'Ouça ao vivo'}</span></button>;}
function RadioPlayer() {
  const {status,volume,toggle,changeVolume,programming}=useRadio();
  const current=programming.current;
  const description=current?[current.title||current.program?.name,current.program?.presenters.map(p=>p.name).join(' · ')].filter(Boolean).join(' / '):'Sua companhia, em qualquer lugar.';
  return <section className="radio-player" aria-label="Player da rádio">
    <div className="radio-identity"><LiveBadge/><div><strong>BIOSFERA RÁDIO</strong><span title={description}>{description}</span></div></div><RadioWave playing={status==='playing'} compact/>
    <button type="button" className="play-button" onClick={toggle} aria-label={status === 'playing' || status === 'loading' ? 'Pausar rádio' : 'Ouvir rádio'}>{status === 'playing' || status === 'loading' ? 'Ⅱ' : '▶'}</button>
    <span className="player-status" role="status">{labels[status]}</span>
    <label className="volume">Volume<input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={event => changeVolume(Number(event.target.value))} /></label>
    <LiveBadge/>
  </section>;
}
export function HomeRadio({siteName,nowPlaying}:{siteName:string;nowPlaying?:{name:string;presenters:string}}) {
  const {status,volume,toggle,changeVolume}=useRadio();
  const active=status==='playing'||status==='loading';
  return <section className="home-radio" aria-labelledby="radio-title" id="radio-ao-vivo"><div className="panel-heading"><h2 id="radio-title">Rádio ao vivo</h2><LiveBadge/></div>
    <div className="radio-feature"><RadioWave playing={status==='playing'}/>
      <div><p className="radio-tagline">A sua companhia, em qualquer lugar.</p></div></div>
    {nowPlaying&&<div className="now-playing"><small>NO AR AGORA</small><strong>{nowPlaying.name}</strong><span>{nowPlaying.presenters}</span></div>}<p className="radio-station">{siteName}</p><div className="home-radio-controls"><button type="button" className="listen-button" aria-label={active?'Pausar transmissão':'Iniciar transmissão'} onClick={toggle}><span aria-hidden="true">{active?'Ⅱ':'▶'}</span>{active?'Pausar':'Ouvir agora'}</button><label>Volume<input aria-label="Volume da transmissão" type="range" min="0" max="1" step="0.01" value={volume} onChange={event=>changeVolume(Number(event.target.value))}/></label></div>
    <p className="home-radio-status" aria-live="polite">{labels[status]}</p>
  </section>;
}
