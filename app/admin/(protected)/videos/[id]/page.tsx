import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireEditorial } from '@/lib/auth/editorial';
import { VideoForm } from '@/components/videos/video-form';
import { videoById } from '@/server/services/videos';

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({
  params,
}: Props) {
  await requireEditorial();

  const { id } =
    await params;

  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      id,
    )
  ) {
    notFound();
  }

  const video =
    await videoById(id);

  if (!video) {
    notFound();
  }

  return (
    <>
      <Link href="/admin/videos">
        ← Vídeos
      </Link>

      <h1 className="form-title">
        Editar vídeo
      </h1>

      <VideoForm
        video={video}
      />
    </>
  );
}