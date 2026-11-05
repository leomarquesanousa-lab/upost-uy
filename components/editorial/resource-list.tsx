/* eslint-disable @next/next/no-img-element -- registered local editorial uploads */
import {portalResources,type ResourceKind} from '@/server/services/portal-resources';
import { RadioStationCard } from '@/components/radio/radio-station-card';
import { radioStation } from '@/server/services/portal-resources';
export async function ResourceList({kind}:{kind:ResourceKind}){
 const {items}=await portalResources(kind);
 if(!items.length)return <p className="empty-state">{kind==='radio'?'Las radios aparecerán aquí cuando se confirmen sus transmisiones autorizadas.':'Los medios asociados aparecerán aquí una vez confirmados por la organización.'}</p>;
 return <div className="news-grid">{items.map(item=>{const station=radioStation(item);if(station)return <RadioStationCard key={item.id} station={station}/>;return <article className="resource-card" key={item.id}>
 {item.image_url&&<img src={item.image_url} alt="" width={300} height={180} loading="lazy"/>}<h2><a href={item.url} target="_blank" rel="noopener noreferrer">{item.name} ↗</a></h2>
 <small>{item.media_type}</small><p>{item.description}</p>
 </article>;})}</div>;
}
