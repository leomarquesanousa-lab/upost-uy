'use client';
import { useEffect,useRef,useState } from 'react';
import { usePathname } from 'next/navigation';
type Delivery={id:string;receipt:string;image:string;mobile:string;alt:string;end:string|null};
export function AdBanner({position}:{position:string}){
 const [ad,setAd]=useState<Delivery|null>(null),[loaded,setLoaded]=useState('');const element=useRef<HTMLElement>(null);const pathname=usePathname();
 useEffect(()=>{let stopped=false;let timer:ReturnType<typeof setTimeout>;const controller=new AbortController();async function load(){if(!document.hidden)try{const r=await fetch(`/api/ads/serve?slot=${encodeURIComponent(position)}`,{cache:'no-store',signal:controller.signal});const next=await r.json();if(!stopped)setAd(next);}catch{if(!stopped)setAd(null);}if(!stopped)timer=setTimeout(load,60000);}void load();return ()=>{stopped=true;controller.abort();clearTimeout(timer);};},[position,pathname]);
 useEffect(()=>{if(!ad?.end)return;const delay=new Date(ad.end).getTime()-Date.now();const timer=setTimeout(()=>setAd(null),Math.min(Math.max(0,delay),2147483647));return ()=>clearTimeout(timer);},[ad]);
 useEffect(()=>{
  if(!ad||loaded!==ad.receipt||!element.current)return;
  let visible=false,sent=false;let timer:ReturnType<typeof setTimeout>|undefined;
  const update=()=>{clearTimeout(timer);if(visible&&!document.hidden&&!sent)timer=setTimeout(()=>{sent=true;void fetch('/api/ads/impression',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:ad.id,receipt:ad.receipt}),keepalive:true}).catch(()=>{});},1000);};
  const observer=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting&&e.intersectionRatio>=.5);update();},{threshold:[0,.5]});observer.observe(element.current);document.addEventListener('visibilitychange',update);
  return ()=>{observer.disconnect();clearTimeout(timer);document.removeEventListener('visibilitychange',update);};
 },[ad,loaded]);
 if(!ad)return null;
 return <aside ref={element} className="ad-banner" aria-label="Publicidade" data-slot={position}><small>PUBLICIDADE</small><a href={`/api/ads/click/${ad.id}?receipt=${ad.receipt}`} target="_blank" rel="sponsored noopener noreferrer"><picture>{ad.mobile&&<source media="(max-width: 760px)" srcSet={ad.mobile}/>}<img key={ad.receipt} src={ad.image} alt={ad.alt} onLoad={()=>setLoaded(ad.receipt)} onError={()=>setAd(null)}/></picture></a></aside>;
}
