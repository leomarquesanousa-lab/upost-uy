import './env.mjs';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../lib/security/password.mjs';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
let client;
try {
  if (!process.env.DATABASE_URL) throw new Error();
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(84201902)');
  const existing = await client.query("SELECT id FROM users WHERE role='OWNER' LIMIT 1");
  if (existing.rowCount) { console.log('OWNER já existe; nenhuma alteração realizada.'); }
  else {
    const name = process.env.ADMIN_INITIAL_OWNER_NAME?.trim();
    const email = process.env.ADMIN_INITIAL_OWNER_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_INITIAL_OWNER_PASSWORD;
    if (!name || name.length > 120 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12 || password.length > 256) throw new Error();
    const id = randomUUID();
    await client.query("INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'OWNER')", [id, name, email, await hashPassword(password)]);
    await client.query("INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES($1,'owner.bootstrap','users',$2)", [id, id]);
    console.log('OWNER criado. Remova as variáveis de bootstrap do ambiente.');
  }
  await client.query('COMMIT');
} catch {
  if (client) await client.query('ROLLBACK').catch(() => {});
  console.error('Bootstrap falhou. Confira banco migrado, nome, e-mail único e senha de 12 a 256 caracteres.'); process.exitCode = 1;
} finally { client?.release(); await pool.end(); }
