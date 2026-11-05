import 'server-only';
import { Pool } from 'pg';
import { secureConnectionString } from './connection-string.mjs';

const globalDb = globalThis as unknown as { upostPool?: Pool };
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('Banco não configurado.');
  if(globalDb.upostPool&&(globalDb.upostPool.options.query_timeout!==12000||globalDb.upostPool.options.connectionTimeoutMillis!==8000)){
    const previous=globalDb.upostPool;globalDb.upostPool=undefined;
    void previous.end().catch(()=>{});
  }
  if (!globalDb.upostPool) {
    globalDb.upostPool = new Pool({ connectionString: secureConnectionString(process.env.DATABASE_URL), max: 10, connectionTimeoutMillis: 8000, idleTimeoutMillis: 30000,statement_timeout:10000,query_timeout:12000,lock_timeout:3000 });
    globalDb.upostPool.on('error', () => console.error('Conexão PostgreSQL interrompida.'));
  }
  return globalDb.upostPool;
}
