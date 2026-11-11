/* eslint-disable @next/next/no-img-element -- existing editorial thumbnails, no generated images */
import Link from 'next/link';
import type {VideoRecord} from '@/server/services/videos';
import {PublicVideoPlayer} from './public-video-player';
import styles from './public-videos.module.css';

export function PublicVideoCard({video:v}:{video:VideoRecord}) {
 return <article className={styles.card} data-video-id={v.id}>
  <Link href={'/videos?video='+encodeURIComponent(v.id)} className={styles.thumbnail} aria-label={'Ver '+v.title}>
   {v.thumbnail_url&&<img src={v.thumbnail_url} alt="" loading="lazy" decoding="async"/>}<span aria-hidden="true">▶</span>
  </Link><div><h2><Link href={'/videos?video='+encodeURIComponent(v.id)}>{v.title}</Link></h2>{v.published_at&&<time dateTime={new Date(v.published_at).toISOString()}>{new Date(v.published_at).toLocaleDateString('es-UY',{timeZone:'America/Montevideo'})}</time>}</div>
 </article>;
}
export function PublicVideos({videos,selected}:{videos:VideoRecord[];selected?:string}) {
 const current=videos.find(v=>v.id===selected);
 const card=(v:VideoRecord)=><PublicVideoCard key={v.id} video={v}/>;
 if(current)return <section className={styles.page}>
  <Link className={styles.back} href="/videos">← Todos los videos</Link>
  <div className={styles.watch}>
   <article className={styles.main}><div className={styles.player}><PublicVideoPlayer key={current.id} videoUrl={current.video_url} thumbnailUrl={current.thumbnail_url} source={current.source} title={current.title}/></div><h1>{current.title}</h1>{current.description&&<p>{current.description}</p>}</article>
   <aside className={styles.related} aria-label="Videos relacionados"><h2>Más videos</h2><div className={styles.relatedList}>{videos.filter(v=>v.id!==current.id).slice(0,6).map(card)}</div></aside>
  </div>
 </section>;
 return <section className={styles.page}><h1>Videos</h1>{videos.length?<div className={styles.gallery}>{videos.map(card)}</div>:<p className="empty-state">Todavía no hay videos publicados.</p>}</section>;
}
