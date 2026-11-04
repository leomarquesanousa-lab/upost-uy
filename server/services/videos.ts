import 'server-only';

import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

import { getPool } from '@/lib/db/pool';
import {
  EditorialError,
  mediaPath,
  slug,
  text,
  uuid,
} from '@/lib/editorial/validation';

export type VideoStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'ARCHIVED';

export type VideoSource =
  | 'YOUTUBE'
  | 'VIMEO'
  | 'EXTERNAL'
  | 'LOCAL';

export type VideoRecord = {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url: string;
  video_url: string;
  source: VideoSource;
  status: VideoStatus;
  featured: boolean;
  published_at: Date | null;
  seo_title: string;
  seo_description: string;
  version: number;
  created_at: Date;
  updated_at: Date;
};

const LOCAL_VIDEO_REGEX =
  /^\/video-media\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(mp4|webm)$/;

async function transaction<T>(
  operation: (client: PoolClient) => Promise<T>,
) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await operation(client);

    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function audit(
  client: PoolClient,
  userId: string,
  action: string,
  id: string,
  metadata: object = {},
) {
  await client.query(
    `
      INSERT INTO audit_log(
        user_id,
        action,
        entity,
        entity_id,
        metadata
      )
      VALUES($1,$2,'videos',$3,$4)
    `,
    [
      userId,
      action,
      id,
      JSON.stringify(metadata),
    ],
  );
}

async function checkMedia(
  client: PoolClient,
  mediaUrl: string,
  message = 'Arquivo não encontrado. Envie novamente.',
) {
  if (!mediaUrl) {
    return;
  }

  const result = await client.query(
    'SELECT id FROM media_assets WHERE path=$1',
    [mediaUrl],
  );

  if (!result.rowCount) {
    throw new EditorialError(message);
  }
}

function normalizeVideoLocation(value: string) {
  const raw = value.trim();

  if (!raw) {
    throw new EditorialError(
      'Informe a URL do vídeo ou envie um arquivo.',
    );
  }

  if (LOCAL_VIDEO_REGEX.test(raw)) {
    return {
      url: raw,
      source: 'LOCAL' as VideoSource,
    };
  }

  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new EditorialError(
      'Informe uma URL de vídeo válida ou envie um arquivo.',
    );
  }

  if (
    parsed.protocol !== 'https:' &&
    parsed.protocol !== 'http:'
  ) {
    throw new EditorialError(
      'A URL do vídeo precisa usar HTTP ou HTTPS.',
    );
  }

  const hostname = parsed.hostname
    .toLowerCase()
    .replace(/^www\./, '');

  let source: VideoSource = 'EXTERNAL';

  if (
    hostname === 'youtube.com' ||
    hostname.endsWith('.youtube.com') ||
    hostname === 'youtu.be'
  ) {
    source = 'YOUTUBE';
  } else if (
    hostname === 'vimeo.com' ||
    hostname.endsWith('.vimeo.com')
  ) {
    source = 'VIMEO';
  }

  return {
    url: parsed.toString(),
    source,
  };
}

function statusValue(
  value: FormDataEntryValue | null,
) {
  const status = String(
    value || 'DRAFT',
  );

  if (
    status !== 'DRAFT' &&
    status !== 'PUBLISHED' &&
    status !== 'ARCHIVED'
  ) {
    throw new EditorialError(
      'Status de vídeo inválido.',
    );
  }

  return status as VideoStatus;
}

function publishedDate(
  status: VideoStatus,
  value: FormDataEntryValue | null,
) {
  if (status !== 'PUBLISHED') {
    return null;
  }

  const raw = String(
    value || '',
  ).trim();

  if (!raw) {
    return new Date();
  }

  const date = new Date(raw);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new EditorialError(
      'Data de publicação inválida.',
    );
  }

  return date;
}

export async function adminVideoList() {
  const result =
    await getPool().query<VideoRecord>(
      `
        SELECT
          id,
          title,
          slug,
          description,
          thumbnail_url,
          video_url,
          source,
          status,
          featured,
          published_at,
          seo_title,
          seo_description,
          version,
          created_at,
          updated_at
        FROM videos
        WHERE deleted_at IS NULL
        ORDER BY
          featured DESC,
          created_at DESC
      `,
    );

  return result.rows;
}

export async function videoById(
  id: string,
) {
  uuid(id);

  const result =
    await getPool().query<VideoRecord>(
      `
        SELECT
          id,
          title,
          slug,
          description,
          thumbnail_url,
          video_url,
          source,
          status,
          featured,
          published_at,
          seo_title,
          seo_description,
          version,
          created_at,
          updated_at
        FROM videos
        WHERE id=$1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [id],
    );

  return result.rows[0] ?? null;
}

export async function publishedVideos() {
  const result =
    await getPool().query<VideoRecord>(
      `
        SELECT
          id,
          title,
          slug,
          description,
          thumbnail_url,
          video_url,
          source,
          status,
          featured,
          published_at,
          seo_title,
          seo_description,
          version,
          created_at,
          updated_at
        FROM videos
        WHERE deleted_at IS NULL
          AND status='PUBLISHED'
          AND (
            published_at IS NULL
            OR published_at <= now()
          )
        ORDER BY
          featured DESC,
          published_at DESC NULLS LAST,
          created_at DESC
      `,
    );

  return result.rows;
}

export async function saveVideo(
  form: FormData,
  userId: string,
) {
  const id = text(
    form,
    'id',
    36,
  );

  if (id) {
    uuid(id);
  }

  const title = text(
    form,
    'title',
    180,
    true,
  );

  const itemSlug = slug(
    form,
    title,
  );

  const description = text(
    form,
    'description',
    10000,
  );

  const thumbnail = mediaPath(
    text(
      form,
      'thumbnail_url',
      200,
    ),
  );

  const videoLocation =
    normalizeVideoLocation(
      text(
        form,
        'video_url',
        2000,
        true,
      ),
    );

  const url =
    videoLocation.url;

  const source =
    videoLocation.source;

  const status = statusValue(
    form.get('status'),
  );

  const featured =
    form.get('featured') === 'on';

  const seoTitle = text(
    form,
    'seo_title',
    180,
  );

  const seoDescription = text(
    form,
    'seo_description',
    320,
  );

  const publishedAt =
    publishedDate(
      status,
      form.get('published_at'),
    );

  const version = Number(
    text(
      form,
      'version',
      12,
    ) || '0',
  );

  return transaction(
    async client => {
      await checkMedia(
        client,
        thumbnail,
        'Imagem de capa não encontrada. Envie novamente.',
      );

      if (
        source === 'LOCAL'
      ) {
        await checkMedia(
          client,
          url,
          'Arquivo de vídeo não encontrado. Envie novamente.',
        );
      }

      const previous = id
        ? (
            await client.query(
              `
                SELECT *
                FROM videos
                WHERE id=$1
                  AND deleted_at IS NULL
                FOR UPDATE
              `,
              [id],
            )
          ).rows[0]
        : null;

      if (
        id &&
        !previous
      ) {
        throw new EditorialError(
          'Vídeo não encontrado.',
        );
      }

      if (
        previous &&
        previous.version !==
          version
      ) {
        throw new EditorialError(
          'Este vídeo foi alterado em outra aba. Recarregue a página antes de editar novamente.',
        );
      }

      const key =
        id || randomUUID();

      if (previous) {
        await client.query(
          `
            UPDATE videos
            SET
              title=$2,
              slug=$3,
              description=$4,
              thumbnail_url=$5,
              video_url=$6,
              source=$7,
              status=$8,
              featured=$9,
              published_at=$10,
              seo_title=$11,
              seo_description=$12,
              updated_by=$13,
              updated_at=now(),
              version=version+1
            WHERE id=$1
          `,
          [
            key,
            title,
            itemSlug,
            description,
            thumbnail,
            url,
            source,
            status,
            featured,
            publishedAt,
            seoTitle,
            seoDescription,
            userId,
          ],
        );
      } else {
        await client.query(
          `
            INSERT INTO videos(
              id,
              title,
              slug,
              description,
              thumbnail_url,
              video_url,
              source,
              status,
              featured,
              published_at,
              seo_title,
              seo_description,
              created_by,
              updated_by
            )
            VALUES(
              $1,$2,$3,$4,$5,$6,$7,
              $8,$9,$10,$11,$12,$13,$13
            )
          `,
          [
            key,
            title,
            itemSlug,
            description,
            thumbnail,
            url,
            source,
            status,
            featured,
            publishedAt,
            seoTitle,
            seoDescription,
            userId,
          ],
        );
      }

      await audit(
        client,
        userId,
        previous
          ? 'videos.update'
          : 'videos.create',
        key,
        {
          status,
          source,
          featured,
        },
      );

      if (
        !previous ||
        previous.status !==
          status
      ) {
        await audit(
          client,
          userId,
          'videos.status',
          key,
          {
            from:
              previous?.status ??
              null,

            to: status,
          },
        );
      }

      return key;
    },
  );
}

export async function deleteVideo(
  form: FormData,
  userId: string,
) {
  const id = uuid(
    text(
      form,
      'id',
      36,
      true,
    ),
  );

  await transaction(
    async client => {
      const existing =
        await client.query(
          `
            SELECT id
            FROM videos
            WHERE id=$1
              AND deleted_at IS NULL
            FOR UPDATE
          `,
          [id],
        );

      if (
        !existing.rowCount
      ) {
        throw new EditorialError(
          'Vídeo não encontrado.',
        );
      }

      await client.query(
        `
          UPDATE videos
          SET
            deleted_at=now(),
            updated_by=$2,
            updated_at=now()
          WHERE id=$1
        `,
        [
          id,
          userId,
        ],
      );

      await audit(
        client,
        userId,
        'videos.delete',
        id,
      );
    },
  );
}