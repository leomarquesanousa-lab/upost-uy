import Link from 'next/link';

import { requireEditorial } from '@/lib/auth/editorial';
import { VideoForm } from '@/components/videos/video-form';

export default async function Page() {
  await requireEditorial();

  return (
    <>
      <Link href="/admin/videos">
        ← Vídeos
      </Link>

      <h1 className="form-title">
        Novo vídeo
      </h1>

      <VideoForm />
    </>
  );
}