'use server';
import { randomBytes, randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPool } from '@/lib/db/pool';
import { tokenHash, verifyPassword } from '@/lib/security/password.mjs';
import { SESSION_COOKIE, SESSION_SECONDS, cookieOptions } from '@/lib/auth/session';

async function sameOrigin() {
  const h = await headers();
  const origin = h.get('origin');
  const host = h.get('x-forwarded-host') || h.get('host');
  try { return Boolean(origin && new URL(origin).host === host); } catch { return false; }
}
export async function login(_state: { error: string }, form: FormData) {
  if (!await sameOrigin()) return { error: 'Origem da solicitação inválida.' };
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 256) return { error: 'Informe e-mail e senha válidos.' };
  let client;
  let token = '';
  try {
    client = await getPool().connect();
    const attempt = await client.query(`INSERT INTO login_attempts(key,attempts) VALUES($1,1)
      ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.window_start < now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
      window_start=CASE WHEN login_attempts.window_start < now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts`, [tokenHash(email)]);
    if (attempt.rows[0].attempts > 5) return { error: 'Muitas tentativas. Aguarde 15 minutos.' };
    const result = await client.query('SELECT id,password_hash,active FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
    const dummy = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
    const valid = await verifyPassword(password, user?.password_hash ?? dummy);
    if (!valid || !user?.active) return { error: 'E-mail ou senha inválidos.' };
    token = randomBytes(32).toString('hex');
    await client.query('BEGIN');
    const active = await client.query('SELECT id FROM users WHERE id=$1 AND active AND password_hash=$2 FOR UPDATE', [user.id,user.password_hash]);
    if (!active.rowCount) { await client.query('ROLLBACK'); return { error: 'E-mail ou senha inválidos.' }; }
    await client.query('DELETE FROM sessions WHERE expires_at<=now()');
    await client.query('INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+$4*interval \'1 second\')', [randomUUID(), user.id, tokenHash(token), SESSION_SECONDS]);
    await client.query('UPDATE users SET last_login_at=now(),updated_at=now() WHERE id=$1', [user.id]);
    await client.query("INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES($1,'auth.login','users',$2)", [user.id, user.id]);
    await client.query('DELETE FROM login_attempts WHERE key=$1 OR window_start<now()-interval \'1 day\'', [tokenHash(email)]);
    await client.query('COMMIT');
  } catch {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return { error: 'Acesso indisponível. Verifique a configuração do banco e as migrations.' };
  } finally { client?.release(); }
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_SECONDS });
  redirect('/admin');
}
export async function logout() {
  if (!await sameOrigin()) throw new Error('Origem inválida.');
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await getPool().query(`WITH removed AS (DELETE FROM sessions WHERE token_hash=$1 RETURNING user_id)
        INSERT INTO audit_log(user_id,action,entity) SELECT user_id,'auth.logout','sessions' FROM removed`, [tokenHash(token)]);
    } catch { throw new Error('Não foi possível encerrar a sessão. Tente novamente.'); }
  }
  jar.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  redirect('/admin/login');
}
