import { NewsEditPage } from '@/components/editorial/news-edit-page';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <NewsEditPage id={(await params).id} />; }
