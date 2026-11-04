'use client';

import {
  useState,
  useTransition,
} from 'react';

import { useRouter } from 'next/navigation';

import { videoAction } from '@/app/admin/video-actions';

type Props = {
  id: string;
  title: string;
};

export function VideoDeleteButton({
  id,
  title,
}: Props) {
  const router = useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    error,
    setError,
  ] = useState('');

  function handleDelete() {
    const confirmed =
      window.confirm(
        `Tem certeza que deseja excluir o vídeo "${title}"?\n\nEssa ação não poderá ser desfeita.`,
      );

    if (!confirmed) {
      return;
    }

    setError('');

    startTransition(
      async () => {
        const form =
          new FormData();

        form.set(
          'intent',
          'delete',
        );

        form.set(
          'id',
          id,
        );

        form.set(
          'videoId',
          id,
        );

        form.set(
          'video_id',
          id,
        );

        const result =
          await videoAction(
            form,
          );

        if (
          !result.ok
        ) {
          setError(
            result.error ||
              'Não foi possível excluir o vídeo.',
          );

          return;
        }

        router.refresh();
      },
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '4px',
      }}
    >
      <button
        type="button"
        onClick={
          handleDelete
        }
        disabled={
          pending
        }
        style={{
          border: 0,
          background:
            'transparent',
          padding: 0,
          color: '#c62828',
          font: 'inherit',
          fontWeight: 700,
          cursor: pending
            ? 'wait'
            : 'pointer',
          opacity: pending
            ? 0.55
            : 1,
        }}
      >
        {pending
          ? 'Excluindo...'
          : 'Excluir'}
      </button>

      {error ? (
        <span
          style={{
            maxWidth:
              '220px',
            color:
              '#c62828',
            fontSize:
              '12px',
            lineHeight:
              1.35,
          }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}