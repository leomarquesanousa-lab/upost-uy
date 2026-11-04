import 'server-only';
import type { Metadata } from 'next';
import type { News } from './types';

export function siteUrl() {
  try {
    const url = new URL(process.env.SITE_URL || 'http://localhost:3000');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.origin;
  } catch {
    return 'http://localhost:3000';
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
      locale: 'pt_BR',
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
  return JSON.stringify(value).replace(/</g, '\u003c');
}
