import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getPool } from '@/lib/db/pool';
import { tokenHash } from '@/lib/security/password.mjs';

export const SESSION_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Host-biosfera_session'
    : 'biosfera_session';

/*
 * Tempo máximo absoluto da sessão.
 *
 * Mesmo que o usuário continue ativo,
 * depois desse período será necessário
 * entrar novamente.
 */
export const SESSION_SECONDS =
  60 * 60 * 8;

/*
 * Tempo máximo sem atividade.
 *
 * 15 minutos sem uso do painel:
 * sessão expira.
 */
export const SESSION_IDLE_SECONDS =
  60 * 15;

export const cookieOptions = {
  httpOnly: true,
  secure:
    process.env.NODE_ENV ===
    'production',
  sameSite: 'lax' as const,
  path: '/',
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role:
    | 'OWNER'
    | 'ADMIN'
    | 'EDITOR';
};

export async function getUser(): Promise<AdminUser | null> {
  const cookieStore =
    await cookies();

  const token =
    cookieStore.get(
      SESSION_COOKIE,
    )?.value;

  if (
    !token ||
    !/^[a-f0-9]{64}$/.test(
      token,
    )
  ) {
    return null;
  }

  try {
    const result =
      await getPool().query<AdminUser>(
        `
          WITH valid AS (
            UPDATE sessions s
            SET
              last_seen_at = now()
            FROM users u
            WHERE
              s.user_id = u.id
              AND s.token_hash = $1
              AND s.expires_at > now()
              AND COALESCE(
                s.last_seen_at,
                s.created_at
              ) >
                now() - interval '15 minutes'
              AND u.active
            RETURNING
              u.id,
              u.name,
              u.email,
              u.role
          )
          SELECT *
          FROM valid
        `,
        [
          tokenHash(token),
        ],
      );

    return (
      result.rows[0] ??
      null
    );
  } catch (error) {
    console.error(
      '[auth] Falha ao validar sessão:',
      error,
    );

    return null;
  }
}

export async function requireUser() {
  const user =
    await getUser();

  if (!user) {
    redirect(
      '/admin/login',
    );
  }

  return user;
}