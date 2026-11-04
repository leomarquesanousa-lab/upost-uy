import 'server-only';
import { Pool } from 'pg';
import { secureConnectionString } from './connection-string.mjs';

const globalDb = globalThis as unknown as { biosferaPool?: Pool };
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('Banco não configurado.');
  if (!globalDb.biosferaPool) {
    globalDb.biosferaPool = new Pool({ connectionString: secureConnectionString(process.env.DATABASE_URL), max: 10, connectionTimeoutMillis: 3000, idleTimeoutMillis: 30000 });
    globalDb.biosferaPool.on('error', () => console.error('Conexão PostgreSQL interrompida.'));
  }
  return globalDb.biosferaPool;
}
