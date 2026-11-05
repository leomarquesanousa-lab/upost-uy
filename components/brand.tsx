import Image from 'next/image';
import type { CSSProperties } from 'react';
import logo from '@/public/brand/upost-logo.png';
import logoLight from '@/public/brand/upost-logo-light.png';
import logoCompact from '@/public/brand/upost-logo-compact.png';
import { brandAssets } from '@/lib/brand';
import styles from './brand.module.css';

type BrandProps = {
  light?: boolean;
  variant?: 'default' | 'header' | 'footer';
  preload?: boolean;
};

export function Brand({ light = false, variant = 'default', preload = false }: BrandProps) {
  const image = variant === 'header' ? logoCompact : light ? logoLight : logo;
  return (
    <span
      className={`upost-brand ${styles.brand} ${variant === 'default' ? '' : styles[variant]}`}
      style={{ '--brand-ratio': image.width / image.height } as CSSProperties}
    >
      <Image
        src={variant === 'header' ? brandAssets.logoCompact : light ? brandAssets.logoLight : brandAssets.logo}
        width={image.width}
        height={image.height}
        alt="UPOST.uy — Periodistas en Red. La verdad nos une."
        className={styles.image}
        sizes={variant === 'header' ? '(max-width: 767px) 187px, 270px' : '206px'}
        preload={preload}
      />
    </span>
  );
}
