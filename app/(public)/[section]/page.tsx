import {ResourceList} from '@/components/editorial/resource-list';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {sections} from '@/lib/portal';
import {pageMetadata,videoMetadata,videoStructuredData,jsonLd} from '@/lib/editorial/seo';
import {PublicNews} from '@/components/editorial/public-news';
import {publishedVideos,publishedVideoById} from '@/server/services/videos';
import {PublicVideos} from '@/components/videos/public-videos';

type Props={params:Promise<{section:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>};
const labels:Record<string,string>={...Object.fromEntries(sections),radios:'Radios en vivo','medios-asociados':'Medios asociados',contacto:'Contacto',videos:'Videos','te-explicamos':'Te explicamos'};
export async function generateMetadata({params,searchParams}:Props):Promise<Metadata>{
 const {section}=await params;
 if(section==='videos'){
  const query=await searchParams;
  if(typeof query.video==='string'){
   const video=await publishedVideoById(query.video);
   return video?videoMetadata(video):{title:'Video no encontrado',robots:{index:false,follow:false}};
  }
 }
 return labels[section]?pageMetadata({title:labels[section]+' | UPOST.uy',description:labels[section]+' — Periodistas en Red.',path:'/'+section}):{title:'Página no encontrada',robots:{index:false}};
}
export default async function Page({params,searchParams}:Props){
 const {section}=await params;
 const title=labels[section];
 if(!title)notFound();
 if(section==='radios'||section==='medios-asociados')return <section><p className="eyebrow">PERIODISTAS EN RED</p><h1>{title}</h1><ResourceList kind={section==='radios'?'radio':'partner'}/></section>;
 if(sections.some(([slug])=>slug===section)||section==='te-explicamos')return <PublicNews query={{...await searchParams,category:section}} title={title}/>;
 if(section==='videos'){
  const videos=await publishedVideos();
  const query=await searchParams;
  const selected=typeof query.video==='string'?await publishedVideoById(query.video):null;
  if(typeof query.video==='string'&&!selected)notFound();
  const structured=selected?videoStructuredData(selected):null;
  return <><PublicVideos videos={videos} selected={selected?.id}/>{structured&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(structured)}}/>}</>;
 }
 return <section className="institutional-page"><p className="eyebrow">PERIODISTAS EN RED</p><h1>{title}</h1><p>{section==='radios'?'Próximamente se incorporarán radios independientes con transmisiones autorizadas.':section==='medios-asociados'?'La lista de medios asociados se publicará una vez confirmada por la organización.':'Los canales de contacto se publicarán cuando sean confirmados por Periodistas en Red.'}</p></section>;
}
