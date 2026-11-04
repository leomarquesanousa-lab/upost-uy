import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { Broadcast } from '@/components/programming/broadcast';
import { PublicVideoPlayer } from '@/components/videos/public-video-player';
import { currentProgramming } from '@/server/services/programming';
import { getSettings } from '@/server/services/settings';
import { publishedVideos } from '@/server/services/videos';
import { ContactForm } from '@/components/contact-form';
import { pageMetadata } from '@/lib/editorial/seo';

type Props = {
  params: Promise<{
    section: string;
  }>;
};

const sectionSeo: Record<
  string,
  {
    title: string;
    description: string;
  }
> = {
  radio: {
    title: 'Rádio ao Vivo | Biosfera Rádio TV Web',
    description:
      'Ouça a Biosfera Rádio TV Web ao vivo e acompanhe a programação enquanto navega pelo portal.',
  },

  videos: {
    title: 'Vídeos | Biosfera Rádio TV Web',
    description:
      'Assista a entrevistas, programas, reportagens e conteúdos especiais da Biosfera Rádio TV Web.',
  },

  contato: {
    title: 'Contato | Biosfera Rádio TV Web',
    description:
      'Entre em contato com a equipe da Biosfera Rádio TV Web para enviar sugestões, dúvidas e ideias.',
  },

  'tv-ao-vivo': {
    title: 'TV ao Vivo | Biosfera Rádio TV Web',
    description:
      'Acompanhe a área de transmissão de TV ao vivo da Biosfera Rádio TV Web.',
  },
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { section } = await params;

  const seo =
    sectionSeo[section];

  if (!seo) {
    return {
      title:
        'Página não encontrada',

      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return pageMetadata({
    ...seo,
    path: `/${section}`,
  });
}

function formatVideoDate(
  value:
    | string
    | Date
    | null
    | undefined,
) {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(date);
}

async function VideosPage() {
  const videos =
    await publishedVideos();

  return (
    <section
      aria-labelledby="videos-title"
    >
      <header>
        <span className="eyebrow">
          CONTEÚDO EM VÍDEO
        </span>

        <h1 id="videos-title">
          Vídeos
        </h1>

        <p
          className="public-page-intro"
          style={{
            marginBottom: '28px',
          }}
        >
          Entrevistas, programas,
          reportagens e conteúdos
          especiais da Biosfera Rádio
          TV Web.
        </p>
      </header>

      {videos.length === 0 ? (
        <div className="videos-empty">
          <span
            className="video-empty-icon"
            aria-hidden="true"
          >
            ▶
          </span>

          <h2>
            Nenhum vídeo publicado
          </h2>

          <p>
            Os próximos vídeos da
            Biosfera aparecerão aqui.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fill, minmax(230px, 1fr))',
            gap: '24px 18px',
            alignItems: 'start',
          }}
        >
          {videos.map(video => {
            const date =
              formatVideoDate(
                video.published_at,
              );

            return (
              <article
                key={video.id}
                style={{
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    aspectRatio:
                      '16 / 9',
                    overflow: 'hidden',
                    borderRadius:
                      '12px',
                    background:
                      '#061b3a',
                  }}
                >
                  <PublicVideoPlayer
                    videoUrl={
                      video.video_url
                    }
                    thumbnailUrl={
                      video.thumbnail_url ||
                      ''
                    }
                    source={
                      video.source
                    }
                    title={
                      video.title
                    }
                  />
                </div>

                <div
                  style={{
                    padding:
                      '12px 4px 0',
                  }}
                >
                  <span
                    style={{
                      display:
                        'inline-flex',
                      alignItems:
                        'center',
                      minHeight:
                        '22px',
                      padding:
                        '3px 9px',
                      marginBottom:
                        '7px',
                      borderRadius:
                        '999px',
                      background:
                        video.featured
                          ? 'var(--cyan-soft)'
                          : 'var(--light-blue)',
                      color:
                        'var(--blue-deep)',
                      fontSize:
                        '10px',
                      lineHeight: 1,
                      fontWeight: 700,
                      letterSpacing:
                        '.04em',
                    }}
                  >
                    {video.featured
                      ? 'DESTAQUE'
                      : 'VÍDEO'}
                  </span>

                  <h2
                    style={{
                      margin:
                        '0 0 7px',
                      fontSize:
                        '18px',
                      lineHeight:
                        1.25,
                      fontWeight:
                        750,
                      letterSpacing:
                        '-.02em',
                      display:
                        '-webkit-box',
                      WebkitBoxOrient:
                        'vertical',
                      WebkitLineClamp:
                        2,
                      overflow:
                        'hidden',
                    }}
                  >
                    {video.title}
                  </h2>

                  {video.description ? (
                    <p
                      style={{
                        margin:
                          '0 0 8px',
                        color:
                          'var(--text-muted)',
                        fontSize:
                          '13px',
                        lineHeight:
                          1.45,
                        display:
                          '-webkit-box',
                        WebkitBoxOrient:
                          'vertical',
                        WebkitLineClamp:
                          2,
                        overflow:
                          'hidden',
                      }}
                    >
                      {
                        video.description
                      }
                    </p>
                  ) : null}

                  {date ? (
                    <small
                      style={{
                        display:
                          'block',
                        color:
                          'var(--text-muted)',
                        fontSize:
                          '11px',
                      }}
                    >
                      {date}
                    </small>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          marginTop: '40px',
        }}
      >
        <Link
          className="button"
          href="/radio"
        >
          Ouvir a rádio ao vivo
        </Link>

        <Link
          className="button secondary"
          href="/programacao"
        >
          Ver programação
        </Link>
      </div>
    </section>
  );
}

export default async function SectionPage({
  params,
}: Props) {
  const { section } =
    await params;

  if (section === 'radio') {
    const [
      settings,
      programming,
    ] = await Promise.all([
      getSettings(),
      currentProgramming(),
    ]);

    return (
      <>
        <h1>
          Rádio ao vivo
        </h1>

        <p className="public-page-intro">
          Sua companhia, em qualquer
          lugar. A transmissão continua
          enquanto você navega pelo
          portal.
        </p>

        <Broadcast
          siteName={
            settings.siteName
          }
          initial={
            programming
          }
        />
      </>
    );
  }

  if (section === 'videos') {
    return <VideosPage />;
  }

  if (section === 'contato') {
    return (
      <section aria-labelledby="contact-title">
        <h1 id="contact-title">
          Contato
        </h1>

        <p className="public-page-intro">
          Sua participação faz parte
          da Biosfera. Compartilhe
          sugestões, dúvidas e ideias
          com a nossa equipe.
        </p>

        <ContactForm />
      </section>
    );
  }

  if (
    section === 'tv-ao-vivo'
  ) {
    return (
      <section className="section-placeholder">
        <h1>
          TV ao vivo
        </h1>

        <p>
          Espaço reservado para a
          futura integração da
          transmissão de TV.
        </p>

        <span className="tag">
          Conteúdo estrutural · Em
          preparação
        </span>

        <Link href="/">
          ← Voltar ao início
        </Link>
      </section>
    );
  }

  notFound();
}