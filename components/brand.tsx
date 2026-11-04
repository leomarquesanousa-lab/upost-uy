import Image from 'next/image';
import { brandAssets } from '@/lib/brand';
export function Brand({ light = false }: { light?: boolean }) {
 return <span className="brand-logo">
  <Image className="brand-image" src={light ? brandAssets.logoLight : brandAssets.logo} width={light ? 1916 : 2172} height={light ? 821 : 724} sizes="(max-width: 760px) 180px, 240px" alt="Biosfera Rádio TV Web" />
 </span>;
}
