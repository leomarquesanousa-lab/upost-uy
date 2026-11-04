import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicCatalog } from '@/components/programming/public';
import { absoluteUrl, jsonLd, pageMetadata, siteUrl } from '@/lib/editorial/seo';
import { publicProgramming } from '@/server/services/programming';
import { getSettings } from '@/server/services/settings';

export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>};

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {slug}=await params;const d=await publicProgramming();const program=d.programs.find(p=>p.slug===slug);
 if(!program)return {title:'Programa não encontrado',robots:{index:false,follow:false}};
 const description=(program.short_description||program.description||`Conheça o programa ${program.name} da Biosfera Rádio TV Web.`).slice(0,180);
 return pageMetadata({title:`${program.name} | Biosfera Rádio TV Web`,description,path:`/programas/${program.slug}`,image:program.cover_image||undefined});
}

export default async function Page({params}:Props){
 const {slug}=await params;const [d,settings]=await Promise.all([publicProgramming(),getSettings()]);const program=d.programs.find(p=>p.slug===slug);if(!program)notFound();
 const structured={
  '@context':'https://schema.org','@type':'CreativeWork',name:program.name,description:program.short_description||program.description||undefined,url:absoluteUrl(`/programas/${program.slug}`),
  ...(program.cover_image?{image:absoluteUrl(program.cover_image)}:{}),publisher:{'@type':'Organization',name:settings.siteName,url:siteUrl()},
  ...(program.presenters.length?{creator:program.presenters.map(p=>({'@type':'Person',name:p.name,url:absoluteUrl(`/apresentadores/${p.slug}`)}))}:{})
 };
 return <><PublicCatalog kind="programs" slug={slug}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(structured)}}/></>;
}
