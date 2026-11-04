import { TaxonomyEdit } from '@/components/editorial/taxonomy-pages';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <TaxonomyEdit kind="authors" id={(await params).id} />; }
