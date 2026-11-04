import type { Metadata } from 'next';
import Link from 'next/link';
import { BannerRotation } from '@/components/home/banner-rotation';
import { Broadcast } from '@/components/programming/broadcast';
import { currentProgramming } from '@/server/services/programming';
import { LiveCamera } from '@/components/home/live-camera';
import { ChatPreview } from '@/components/home/chat-preview';
import { SongRequest } from '@/components/home/song-request';
import { NewsCard } from '@/components/editorial/news-card';
import { pageMetadata } from '@/lib/editorial/seo';
import { getSettings } from '@/server/services/settings';
import { homeNews } from '@/server/repositories/editorial';

export const metadata: Metadata = pageMetadata({
  title: 'Biosfera Rádio TV Web | Notícias, Rádio e TV ao Vivo',
  description: 'Acompanhe notícias, rádio ao vivo, programação, entrevistas e conteúdos da Biosfera Rádio TV Web.',
  path: '/',
});

export default async function Home() {
  const [settings,news,programming]=await Promise.all([getSettings(),homeNews(),currentProgramming()]);
  return <div className="portal-home">
    <div className="home-welcome"><p className="eyebrow">SINTONIZE. PARTICIPE. CONECTE-SE.</p><h1>Informação, música e conexão ao vivo.</h1></div>
    <Broadcast siteName={settings.siteName} initial={programming}/>
    <div className="home-banner-area">
      <BannerRotation/>
      <aside className="home-ad-placeholder" aria-label="Espaço reservado para publicidade">
        <span className="eyebrow">PUBLICIDADE</span>
        <div className="home-ad-outline" aria-hidden="true"><span/></div>
        <p>Espaço reservado<br/>para anúncio</p>
      </aside>
    </div>
    <section className="home-latest" aria-labelledby="latest-news-title">
      <div className="home-section-heading"><h2 id="latest-news-title">Últimas notícias</h2></div>
      {news.lead.length > 0 ? <div className="news-grid">{news.lead.map(item => <NewsCard key={item.id} news={item} home />)}</div> : <p className="empty-state">Em breve, acompanhe aqui as notícias da Biosfera.</p>}
    </section>
    <section className="home-all-news" aria-labelledby="all-news-title">
      <div className="home-section-heading"><h2 id="all-news-title">Acompanhe todas as notícias</h2></div>
      {news.recent.length > 0 && <div className="home-compact-news-grid">{news.recent.map(item => <NewsCard key={item.id} news={item} home />)}</div>}
      <div className="home-all-news-action"><Link className="button" href="/noticias">Ver todas as notícias →</Link></div>
    </section>
    <div className="portal-row community-row"><LiveCamera url={settings.liveCameraEmbedUrl} /><ChatPreview /></div>
    <SongRequest startedAt={news.renderedAt} />
  </div>;
}
