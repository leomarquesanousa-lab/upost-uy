import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicCatalog } from '@/components/programming/public';
import { absoluteUrl, jsonLd, pageMetadata, siteUrl } from '@/lib/editorial/seo';
import { publicProgramming } from '@/server/services/programming';
import { getSettings } from '@/server/services/settings';

export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>};

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {slug}=await params;const d=await publicProgramming();const presenter=d.presenters.find(p=>p.slug===slug);
 if(!presenter)return {title:'Apresentador não encontrado',robots:{index:false,follow:false}};
 const description=(presenter.bio||`Conheça ${presenter.name}, apresentador da Biosfera Rádio TV Web.`).replace(/\s+/g,' ').trim().slice(0,180);
 return pageMetadata({title:`${presenter.name} | Biosfera Rádio TV Web`,description,path:`/apresentadores/${presenter.slug}`,image:presenter.photo_url||undefined});
}

export default async function Page({params}:Props){
 const {slug}=await params;const [d,settings]=await Promise.all([publicProgramming(),getSettings()]);const presenter=d.presenters.find(p=>p.slug===slug);if(!presenter)notFound();
 const sameAs=[presenter.social_instagram,presenter.social_facebook,presenter.social_x].filter(Boolean);
 const structured={
  '@context':'https://schema.org','@type':'Person',name:presenter.name,description:presenter.bio||undefined,url:absoluteUrl(`/apresentadores/${presenter.slug}`),
  ...(presenter.photo_url?{image:absoluteUrl(presenter.photo_url)}:{}),...(sameAs.length?{sameAs}:{}),worksFor:{'@type':'Organization',name:settings.siteName,url:siteUrl()}
 };
 return <><PublicCatalog kind="presenters" slug={slug}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(structured)}}/></>;
}
