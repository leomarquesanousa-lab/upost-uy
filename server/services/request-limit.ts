import 'server-only';
import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db/pool';
export async function consumeLimit(key: string, limit: number, seconds: number, client?: PoolClient) {
  const db=client || getPool();
  const result=await db.query(`INSERT INTO request_limits(key,attempts) VALUES($1,1)
    ON CONFLICT(key) DO UPDATE SET
    attempts=CASE WHEN request_limits.window_start < now()-$2*interval '1 second' THEN 1 ELSE request_limits.attempts+1 END,
    window_start=CASE WHEN request_limits.window_start < now()-$2*interval '1 second' THEN now() ELSE request_limits.window_start END
    RETURNING attempts`,[key,seconds]);
  return result.rows[0].attempts<=limit;
}
