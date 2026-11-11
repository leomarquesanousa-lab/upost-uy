import Link from 'next/link';
import type {VideoRecord} from '@/server/services/videos';
import {PublicVideoCard} from '@/components/videos/public-videos';
import styles from './home-videos.module.css';

export function HomeVideos({videos}:{videos:VideoRecord[]}) {
 if(!videos.length)return null;
 return <section className={styles.section} aria-labelledby="home-videos-title" data-home-videos>
  <div className={styles.heading}><h2 id="home-videos-title">Videos</h2><Link href="/videos">Ver más videos <span aria-hidden="true">→</span></Link></div>
  <div className={styles.grid}>{videos.slice(0,3).map(video=><PublicVideoCard key={video.id} video={video}/>)}</div>
 </section>;
}
