import Link from 'next/link';

import { requireEditorial } from '@/lib/auth/editorial';

import { VideoDeleteButton } from '@/components/videos/video-delete-button';

import { adminVideoList } from '@/server/services/videos';

const statusLabel = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Arquivado',
};

export default async function Page() {
  await requireEditorial();

  const videos =
    await adminVideoList();

  return (
    <>
      <p className="eyebrow">
        CONTEÚDO EM VÍDEO
      </p>

      <div className="editorial-heading">
        <h1>
          Vídeos
        </h1>

        <Link
          className="button"
          href="/admin/videos/novo"
        >
          Novo vídeo
        </Link>
      </div>

      {!videos.length ? (
        <p className="empty-state">
          Nenhum vídeo cadastrado.
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  Título
                </th>

                <th>
                  Origem
                </th>

                <th>
                  Status
                </th>

                <th>
                  Destaque
                </th>

                <th>
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {videos.map(
                video => (
                  <tr
                    key={
                      video.id
                    }
                  >
                    <td>
                      {
                        video.title
                      }
                    </td>

                    <td>
                      {
                        video.source
                      }
                    </td>

                    <td>
                      {
                        statusLabel[
                          video.status
                        ]
                      }
                    </td>

                    <td>
                      {video.featured
                        ? 'Sim'
                        : 'Não'}
                    </td>

                    <td>
                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center',
                          gap:
                            '16px',
                          flexWrap:
                            'wrap',
                        }}
                      >
                        <Link
                          href={`/admin/videos/${video.id}`}
                        >
                          Editar →
                        </Link>

                        <VideoDeleteButton
                          id={
                            video.id
                          }
                          title={
                            video.title
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}