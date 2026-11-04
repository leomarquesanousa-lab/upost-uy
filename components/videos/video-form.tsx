'use client';

import {
  useState,
  useTransition,
} from 'react';

import { useRouter } from 'next/navigation';

import { videoAction } from '@/app/admin/video-actions';
import { slugify } from '@/lib/editorial/shared';
import { ImageUpload } from '@/components/editorial/image-upload';
import { VideoUpload } from '@/components/videos/video-upload';

import type {
  VideoRecord,
  VideoStatus,
} from '@/server/services/videos';

function isUploadedVideo(url: string) {
  return /^\/(media|videos?|uploads?)\//i.test(url);
}

export function VideoForm({
  video,
}: {
  video?: VideoRecord;
}) {
  const router = useRouter();

  const initialSource =
    video?.video_url && isUploadedVideo(video.video_url)
      ? 'upload'
      : 'link';

  const [title, setTitle] = useState(video?.title || '');
  const [slug, setSlug] = useState(video?.slug || '');
  const [slugEdited, setSlugEdited] = useState(Boolean(video));
  const [thumbnail, setThumbnail] = useState(video?.thumbnail_url || '');
  const [status, setStatus] = useState<VideoStatus>(video?.status || 'DRAFT');
  const [sourceType, setSourceType] = useState<'link' | 'upload'>(
    initialSource,
  );
  const [externalUrl, setExternalUrl] = useState(
    initialSource === 'link' ? video?.video_url || '' : '',
  );
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState(
    initialSource === 'upload' ? video?.video_url || '' : '',
  );
  const [error, setError] = useState('');

  const [pending, startTransition] = useTransition();

  function submit(form: FormData, intent: 'save' | 'delete' = 'save') {
    setError('');

    if (intent === 'save') {
      const finalVideoUrl =
        sourceType === 'upload'
          ? uploadedVideoUrl.trim()
          : externalUrl.trim();

      if (!finalVideoUrl) {
        setError(
          sourceType === 'upload'
            ? 'Envie um vídeo do computador antes de salvar.'
            : 'Informe a URL do vídeo.',
        );
        return;
      }

      form.set('video_url', finalVideoUrl);
      form.set('source_type', sourceType);
    }

    startTransition(async () => {
      const result = await videoAction(form);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.push('/admin/videos?salvo=1');
      router.refresh();
    });
  }

  return (
    <form
      className="editorial-form"
      onSubmit={event => {
        event.preventDefault();
        submit(new FormData(event.currentTarget), 'save');
      }}
    >
      <input
        type="hidden"
        name="id"
        value={video?.id || ''}
      />

      <input
        type="hidden"
        name="version"
        value={video?.version || 0}
      />

      <label>
        Título *

        <input
          name="title"
          value={title}
          required
          maxLength={180}
          onChange={event => {
            const value = event.target.value;
            setTitle(value);

            if (!slugEdited) {
              setSlug(slugify(value));
            }
          }}
        />
      </label>

      <label>
        Slug *

        <input
          name="slug"
          required
          maxLength={200}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          value={slug}
          onChange={event => {
            setSlugEdited(true);
            setSlug(event.target.value);
          }}
        />
      </label>

      <fieldset
        style={{
          border: '1px solid rgba(15, 23, 42, 0.12)',
          borderRadius: '1rem',
          padding: '1rem',
          display: 'grid',
          gap: '1rem',
          background: 'rgba(255,255,255,0.66)',
        }}
      >
        <legend
          style={{
            fontWeight: 700,
            color: '#0b2247',
            padding: '0 0.5rem',
          }}
        >
          Origem do vídeo *
        </legend>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={() => setSourceType('link')}
            style={{
              border: sourceType === 'link'
                ? '1px solid #2563eb'
                : '1px solid rgba(15, 23, 42, 0.12)',
              borderRadius: '0.9rem',
              padding: '1rem',
              background: sourceType === 'link'
                ? 'linear-gradient(180deg, rgba(37,99,235,0.08), rgba(34,211,238,0.08))'
                : '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <strong
              style={{
                display: 'block',
                color: '#0b2247',
                marginBottom: '0.25rem',
              }}
            >
              Usar link
            </strong>

            <span
              style={{
                color: '#64748b',
                fontSize: '0.92rem',
              }}
            >
              YouTube, Vimeo ou link externo.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSourceType('upload')}
            style={{
              border: sourceType === 'upload'
                ? '1px solid #2563eb'
                : '1px solid rgba(15, 23, 42, 0.12)',
              borderRadius: '0.9rem',
              padding: '1rem',
              background: sourceType === 'upload'
                ? 'linear-gradient(180deg, rgba(37,99,235,0.08), rgba(34,211,238,0.08))'
                : '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <strong
              style={{
                display: 'block',
                color: '#0b2247',
                marginBottom: '0.25rem',
              }}
            >
              Enviar do computador
            </strong>

            <span
              style={{
                color: '#64748b',
                fontSize: '0.92rem',
              }}
            >
              MP4 ou WebM, com upload direto.
            </span>
          </button>
        </div>

        {sourceType === 'link' ? (
          <>
            <label>
              URL do vídeo *

              <input
                type="url"
                required
                maxLength={2000}
                value={externalUrl}
                onChange={event => setExternalUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </label>

            <p className="muted">
              Aceita YouTube, Vimeo e links externos.
            </p>
          </>
        ) : (
          <>
            <VideoUpload
              label="Arquivo de vídeo *"
              value={uploadedVideoUrl}
              onChange={setUploadedVideoUrl}
            />

            <p className="muted">
              Depois do envio, o arquivo será usado automaticamente no cadastro do vídeo.
            </p>
          </>
        )}
      </fieldset>

      <label>
        Descrição

        <textarea
          name="description"
          maxLength={10000}
          rows={7}
          defaultValue={video?.description || ''}
        />
      </label>

      <ImageUpload
        label="Capa / thumbnail"
        value={thumbnail}
        onChange={setThumbnail}
      />

      <input
        type="hidden"
        name="thumbnail_url"
        value={thumbnail}
      />

      <label>
        Status

        <select
          name="status"
          value={status}
          onChange={event =>
            setStatus(event.target.value as VideoStatus)
          }
        >
          <option value="DRAFT">Rascunho</option>
          <option value="PUBLISHED">Publicado</option>
          <option value="ARCHIVED">Arquivado</option>
        </select>
      </label>

      {status === 'PUBLISHED' && (
        <label>
          Data de publicação

          <input
            type="datetime-local"
            name="published_at"
            defaultValue={
              video?.published_at
                ? new Date(video.published_at)
                    .toISOString()
                    .slice(0, 16)
                : ''
            }
          />
        </label>
      )}

      <label className="check-label">
        <input
          type="checkbox"
          name="featured"
          defaultChecked={video?.featured ?? false}
        />
        Vídeo em destaque
      </label>

      <hr />

      <h2>SEO</h2>

      <label>
        Título SEO

        <input
          name="seo_title"
          maxLength={180}
          defaultValue={video?.seo_title || ''}
          placeholder="Se vazio, será usado o título do vídeo"
        />
      </label>

      <label>
        Descrição SEO

        <textarea
          name="seo_description"
          maxLength={320}
          rows={3}
          defaultValue={video?.seo_description || ''}
          placeholder="Descrição para mecanismos de busca"
        />
      </label>

      {error && (
        <p
          className="form-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="form-actions">
        <button
          className="button"
          disabled={pending}
        >
          {pending ? 'Salvando…' : 'Salvar vídeo'}
        </button>

        {video && (
          <button
            type="button"
            className="button danger"
            disabled={pending}
            onClick={() => {
              if (!window.confirm('Excluir este vídeo?')) {
                return;
              }

              const data = new FormData();
              data.set('id', video.id);
              data.set('intent', 'delete');

              submit(data, 'delete');
            }}
          >
            Excluir
          </button>
        )}
      </div>
    </form>
  );
}