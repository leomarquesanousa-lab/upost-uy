import Link from 'next/link';
import Image from 'next/image';
import {portalResources} from '@/server/services/portal-resources';
import styles from './associated-media.module.css';
export async function AssociatedMedia(){
 const [partners,sources]=await Promise.all([portalResources('partner'),portalResources('source')]);
 if(!partners.items.length&&!sources.items.length)return null;
 const logos=(items:typeof partners.items)=><div className={styles.logos}>{items.map(item=><Link className={styles.logo} href={'/medios-asociados?fuente='+item.id} key={item.id}>{item.image_url?<Image src={item.image_url} width={140} height={48} alt={item.name}/>:item.name}</Link>)}</div>;
 return <section className={styles.section} aria-label="Medios asociados y fuentes"><div className={styles.heading}><h2>Medios Asociados</h2><Link href="/medios-asociados">Ver medios y fuentes →</Link></div>{logos(partners.items)}{sources.items.length>0&&<div className={styles.external}><h3>Fuentes externas</h3><p>Información de origen. No implica una asociación formal.</p>{logos(sources.items)}</div>}</section>;
}
