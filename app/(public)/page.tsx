import type {Metadata} from 'next';
import {HomeNews} from '@/components/home/home-news';
import {AdBanner} from '@/components/ads/banner';
import {adPositions} from '@/lib/admin/policy.mjs';
import {pageMetadata,jsonLd,siteUrl} from '@/lib/editorial/seo';
import {homeNews,queryValue,sourceNewsHighlights} from '@/server/repositories/editorial';
import {SourceNews} from '@/components/editorial/source-news';
import {initialSources} from '@/lib/editorial/source-sync.mjs';
import {toNewsCardData} from '@/lib/editorial/types';
import styles from './home.module.css';
import {TopBanners} from '@/components/ads/top-banners';
import {HomeVideos} from '@/components/home/home-videos';
import {publishedVideos} from '@/server/services/videos';

export const metadata:Metadata=pageMetadata({
  title:'UPOST.uy | Periodistas en Red',
  description:'Periodistas en Red. La verdad nos une.',path:'/'
});

export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const page=queryValue((await searchParams).page);
  const [news,videos]=await Promise.all([homeNews(page),publishedVideos({home:true})]);
  const sources=await sourceNewsHighlights(initialSources.map(s=>s.url),[...news.lead,...news.recent].map(n=>n.id));
  return <div className={`upost-home ${styles.home}`}>
    <TopBanners/>
    <HomeNews items={[...news.lead,...news.recent].map(toNewsCardData)} page={news.page} pages={news.pages} excludedIds={sources.map(n=>n.id)} interlude={<AdBanner position={adPositions.homeBetween}/>}/>
    <SourceNews items={sources}/>
    <HomeVideos videos={videos}/>
    <AdBanner position={adPositions.homeBottom}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@type':'WebSite',name:'UPOST.uy',url:siteUrl(),inLanguage:'es-UY'})}}/>
  </div>;
}
