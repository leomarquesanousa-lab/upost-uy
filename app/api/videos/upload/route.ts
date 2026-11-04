import { randomUUID } from 'node:crypto';

import { getUser } from '@/lib/auth/session';
import { getPool } from '@/lib/db/pool';

import {
  discardVideo,
  storeVideo,
} from '@/server/services/storage';

export const runtime = 'nodejs';

const MAX_VIDEO_BYTES =
  100 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'video/mp4',
  'video/webm',
]);

function normalizeContentType(
  value: string | null,
) {
  return (
    value
      ?.split(';')[0]
      ?.trim()
      ?.toLowerCase() || ''
  );
}

export async function POST(
  request: Request,
) {
  const user =
    await getUser();

  if (
    !user ||
    ![
      'OWNER',
      'ADMIN',
      'EDITOR',
    ].includes(user.role)
  ) {
    return Response.json(
      {
        error:
          'Acesso não autorizado.',
      },
      {
        status: 401,
      },
    );
  }

  try {
    const expectedHost =
      request.headers.get(
        'x-forwarded-host',
      ) ||
      request.headers.get(
        'host',
      );

    const origin =
      request.headers.get(
        'origin',
      );

    if (
      origin &&
      expectedHost &&
      new URL(origin).host !==
        expectedHost
    ) {
      return Response.json(
        {
          error:
            'Origem inválida.',
        },
        {
          status: 403,
        },
      );
    }
  } catch {
    return Response.json(
      {
        error:
          'Origem inválida.',
      },
      {
        status: 403,
      },
    );
  }

  const contentType =
    normalizeContentType(
      request.headers.get(
        'content-type',
      ),
    );

  if (
    !ALLOWED_TYPES.has(
      contentType,
    )
  ) {
    return Response.json(
      {
        error:
          `Formato não permitido: ${
            contentType ||
            'desconhecido'
          }. Use MP4 ou WebM.`,
      },
      {
        status: 415,
      },
    );
  }

  let bytes: Buffer;

  try {
    const arrayBuffer =
      await request.arrayBuffer();

    bytes =
      Buffer.from(
        arrayBuffer,
      );
  } catch (error) {
    console.error(
      '[video-upload] Erro ao ler arquivo:',
      error,
    );

    return Response.json(
      {
        error:
          'Não foi possível ler o arquivo enviado.',
      },
      {
        status: 400,
      },
    );
  }

  if (
    bytes.length === 0
  ) {
    return Response.json(
      {
        error:
          'O arquivo enviado está vazio.',
      },
      {
        status: 400,
      },
    );
  }

  if (
    bytes.length >
    MAX_VIDEO_BYTES
  ) {
    return Response.json(
      {
        error:
          `O vídeo possui ${(
            bytes.length /
            1024 /
            1024
          ).toFixed(
            2,
          )} MB. O limite é 100 MB.`,
      },
      {
        status: 413,
      },
    );
  }

  console.log(
    '[video-upload]',
    {
      contentType,
      bytes:
        bytes.length,
      megabytes:
        (
          bytes.length /
          1024 /
          1024
        ).toFixed(3),
    },
  );

  let stored = '';

  try {
    stored =
      await storeVideo(
        bytes,
        contentType,
      );

    console.log(
      '[video-upload] Arquivo gravado:',
      stored,
    );

    const client =
      await getPool().connect();

    try {
      await client.query(
        'BEGIN',
      );

      const id =
        randomUUID();

      await client.query(
        `
          INSERT INTO media_assets(
            id,
            path,
            mime_type,
            size,
            created_by
          )
          VALUES(
            $1,
            $2,
            $3,
            $4,
            $5
          )
        `,
        [
          id,
          stored,
          contentType,
          bytes.length,
          user.id,
        ],
      );

      await client.query(
        `
          INSERT INTO audit_log(
            user_id,
            action,
            entity,
            entity_id
          )
          VALUES(
            $1,
            'media.video_upload',
            'media_assets',
            $2
          )
        `,
        [
          user.id,
          id,
        ],
      );

      await client.query(
        'COMMIT',
      );
    } catch (error) {
      await client.query(
        'ROLLBACK',
      );

      console.error(
        '[video-upload] Erro no banco:',
        error,
      );

      throw error;
    } finally {
      client.release();
    }

    return Response.json(
      {
        url: stored,
        size: bytes.length,
        mimeType:
          contentType,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      '[video-upload] Falha completa:',
      error,
    );

    if (stored) {
      await discardVideo(
        stored,
      );
    }

    return Response.json(
      {
        error:
          'O arquivo foi recebido, mas ocorreu um erro ao processar o upload. Veja o terminal do servidor.',
      },
      {
        status: 500,
      },
    );
  }
}