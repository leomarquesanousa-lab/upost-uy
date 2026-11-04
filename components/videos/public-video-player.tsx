'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

type Props = {
  videoUrl: string;
  thumbnailUrl?: string;
  source: string;
  title: string;
};

function youtubeEmbedUrl(
  url: string,
) {
  try {
    const parsed =
      new URL(url);

    if (
      parsed.hostname === 'youtu.be' ||
      parsed.hostname ===
        'www.youtu.be'
    ) {
      const id =
        parsed.pathname
          .replace('/', '')
          .trim();

      return id
        ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`
        : null;
    }

    if (
      parsed.hostname.includes(
        'youtube.com',
      )
    ) {
      if (
        parsed.pathname.startsWith(
          '/embed/',
        )
      ) {
        const id =
          parsed.pathname
            .split('/embed/')[1]
            ?.split('/')[0];

        return id
          ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`
          : null;
      }

      if (
        parsed.pathname.startsWith(
          '/shorts/',
        )
      ) {
        const id =
          parsed.pathname
            .split('/shorts/')[1]
            ?.split('/')[0];

        return id
          ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`
          : null;
      }

      const id =
        parsed.searchParams.get(
          'v',
        );

      return id
        ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`
        : null;
    }
  } catch {
    return null;
  }

  return null;
}

function vimeoEmbedUrl(
  url: string,
) {
  try {
    const parsed =
      new URL(url);

    if (
      !parsed.hostname.includes(
        'vimeo.com',
      )
    ) {
      return null;
    }

    const parts =
      parsed.pathname
        .split('/')
        .filter(Boolean);

    const id =
      [...parts]
        .reverse()
        .find(part =>
          /^\d+$/.test(
            part,
          ),
        );

    return id
      ? `https://player.vimeo.com/video/${id}?autoplay=1`
      : null;
  } catch {
    return null;
  }
}

export function PublicVideoPlayer({
  videoUrl,
  thumbnailUrl = '',
  source,
  title,
}: Props) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const isLocal =
    source === 'LOCAL' ||
    videoUrl.startsWith(
      '/video-media/',
    );

  const youtube =
    !isLocal
      ? youtubeEmbedUrl(
          videoUrl,
        )
      : null;

  const vimeo =
    !isLocal &&
    !youtube
      ? vimeoEmbedUrl(
          videoUrl,
        )
      : null;

  async function openVideo() {
    setOpen(true);

    try {
      if (
        document.documentElement
          .requestFullscreen
      ) {
        await document
          .documentElement
          .requestFullscreen();
      }
    } catch {
      // O modal continua ocupando a janela,
      // mesmo quando o navegador bloqueia fullscreen.
    }
  }

  async function closeVideo() {
    if (videoRef.current) {
      videoRef.current.pause();
    }

    setOpen(false);

    try {
      if (
        document.fullscreenElement
      ) {
        await document.exitFullscreen();
      }
    } catch {
      // Nada a fazer.
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === 'Escape'
      ) {
        void closeVideo();
      }
    }

    window.addEventListener(
      'keydown',
      onKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        onKeyDown,
      );
    };
  }, [open]);

  useEffect(() => {
    if (
      open &&
      isLocal &&
      videoRef.current
    ) {
      void videoRef.current
        .play()
        .catch(() => {});
    }
  }, [
    open,
    isLocal,
  ]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void openVideo();
        }}
        aria-label={`Assistir ${title}`}
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          height: '100%',
          padding: 0,
          border: 0,
          borderRadius: 0,
          overflow: 'hidden',
          cursor: 'pointer',
          background: '#061b3a',
        }}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              background:
                '#061b3a',
            }}
          />
        ) : isLocal ? (
          <video
            src={videoUrl}
            preload="metadata"
            muted
            playsInline
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              background:
                '#061b3a',
              pointerEvents:
                'none',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background:
                'linear-gradient(135deg,#061b3a,#0c3264)',
            }}
          />
        )}

        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background:
              'rgba(3,19,44,.18)',
          }}
        >
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background:
                'rgba(255,255,255,.94)',
              color: '#075cca',
              fontSize: '22px',
              paddingLeft: '4px',
              boxShadow:
                '0 6px 24px rgba(0,0,0,.22)',
            }}
          >
            ▶
          </span>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'grid',
            placeItems: 'center',
            background:
              'rgba(0,0,0,.96)',
            padding: '20px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              void closeVideo();
            }}
            aria-label="Fechar vídeo"
            style={{
              position: 'absolute',
              top: '18px',
              right: '22px',
              zIndex: 2,
              width: '48px',
              height: '48px',
              display: 'grid',
              placeItems: 'center',
              border: 0,
              borderRadius: '50%',
              background:
                'rgba(255,255,255,.15)',
              color: '#fff',
              fontSize: '28px',
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>

          {isLocal ? (
            <video
              ref={videoRef}
              src={videoUrl}
              poster={
                thumbnailUrl ||
                undefined
              }
              controls
              autoPlay
              playsInline
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                maxWidth:
                  '100vw',
                maxHeight:
                  '100vh',
                objectFit:
                  'contain',
                background:
                  '#000',
              }}
            />
          ) : youtube ? (
            <iframe
              src={youtube}
              title={title}
              allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{
                width: '100%',
                height: '100%',
                maxWidth:
                  '100vw',
                maxHeight:
                  '100vh',
                border: 0,
                background:
                  '#000',
              }}
            />
          ) : vimeo ? (
            <iframe
              src={vimeo}
              title={title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              style={{
                width: '100%',
                height: '100%',
                maxWidth:
                  '100vw',
                maxHeight:
                  '100vh',
                border: 0,
                background:
                  '#000',
              }}
            />
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              poster={
                thumbnailUrl ||
                undefined
              }
              controls
              autoPlay
              playsInline
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit:
                  'contain',
                background:
                  '#000',
              }}
            />
          )}
        </div>
      )}
    </>
  );
}