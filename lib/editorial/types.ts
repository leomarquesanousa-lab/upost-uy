import type { NewsStatus } from './validation';
export type TaxonomyKind = 'categories' | 'authors';
export type Taxonomy = { id: string; name: string; slug: string; description?: string; bio?: string; photo_url?: string; active: boolean; updated_at: Date };
export type News = {
  id: string; title: string; slug: string; subtitle: string; excerpt: string; body: string;
  cover_image: string; cover_alt: string; cover_caption: string; cover_credit: string;
  author_id: string; author_name: string; author_bio: string; author_photo: string;
  status: NewsStatus; published_at: Date | null; scheduled_at: Date | null; visible_at: Date | null;
  featured: boolean; seo_title: string; seo_description: string; canonical_url: string;
  created_at: Date; updated_at: Date; version: number; categories: Taxonomy[];
  source_name: string; source_url: string;
};
