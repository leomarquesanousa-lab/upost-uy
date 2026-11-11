import 'server-only';
import type { Metadata } from 'next';
import type { News } from './types';
import type {VideoRecord} from '@/server/services/videos';
import {automaticSeo} from './automatic-seo.mjs';

export function siteUrl() {
  try {
    const url = new URL(process.env.SITE_URL || 'https://upost.uy');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.origin;
  } catch {
    return 'https://upost.uy';
  }
}

export function absoluteUrl(path = '/') {
  return new URL(path, `${siteUrl()}/`).toString();
}

export function articleUrl(news: News) {
  return news.canonical_url || `${siteUrl()}/noticias/${news.slug}`;
}

export function pageMetadata({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const url = absoluteUrl(path);
  const images = image ? [{ url: absoluteUrl(image) }] : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'es_UY',
      title,
      description,
      url,
      images,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [absoluteUrl(image)] : undefined,
    },
  };
}

export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, () => String.fromCharCode(92)+'u003c');
}

export function sharingImage(value?:string){
 if(!value)return undefined;
 try{const url=new URL(value,siteUrl());if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return undefined;return url.href;}catch{return undefined;}
}
export function newsMetadata(news:News):Metadata{
 const seo=automaticSeo(news),image=sharingImage(news.cover_image),images=image?[{url:image,alt:news.cover_alt}]:[];
 return {title:seo.seo_title,description:seo.seo_description,alternates:{canonical:articleUrl(news)},
  openGraph:{type:'article',title:seo.seo_title,description:seo.seo_description,url:articleUrl(news),images,locale:'es_UY',publishedTime:news.visible_at?.toISOString(),modifiedTime:news.updated_at.toISOString(),authors:news.author_name?[news.author_name]:undefined},
  twitter:{card:image?'summary_large_image':'summary',title:seo.seo_title,description:seo.seo_description,images}};
}
export function videoMetadata(video:VideoRecord):Metadata{
 const seo=automaticSeo(video),image=sharingImage(video.thumbnail_url);
 const metadata=pageMetadata({title:seo.seo_title,description:seo.seo_description,path:'/videos?video='+encodeURIComponent(video.id),image});
 return {...metadata,openGraph:{...metadata.openGraph,type:'video.other'}};
}
function videoEmbedUrl(value:string){
 try{const url=new URL(value),host=url.hostname.replace(/^www\./,'');
  if(host==='youtube.com'||host==='youtu.be'){
   const id=host==='youtu.be'?url.pathname.slice(1):url.searchParams.get('v')||url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
   if(id&&/^[\w-]{11}$/.test(id))return 'https://www.youtube-nocookie.com/embed/'+id;
  }
  if(host==='vimeo.com'||host==='player.vimeo.com'){const id=url.pathname.match(/(?:^\/|\/video\/)(\d+)$/)?.[1];if(id)return 'https://player.vimeo.com/video/'+id;}
 }catch{}return undefined;
}
export function videoStructuredData(video:VideoRecord){
 const seo=automaticSeo(video),image=sharingImage(video.thumbnail_url);
 // Rich video data requires an actual thumbnail and known publication date.
 if(!image||!video.published_at)return null;
 const embed=videoEmbedUrl(video.video_url);
 return {'@context':'https://schema.org','@type':'VideoObject',name:video.title,description:seo.seo_description,thumbnailUrl:[image],uploadDate:new Date(video.published_at).toISOString(),url:absoluteUrl('/videos?video='+encodeURIComponent(video.id)),...(embed?{embedUrl:embed}:{}),
  ...(/\.(?:mp4|webm)(?:\?|$)/i.test(video.video_url)?{contentUrl:sharingImage(video.video_url)}:{})};
}
