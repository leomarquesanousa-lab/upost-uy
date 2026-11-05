import 'server-only';
import { marketEndpoints, normalizeMarket } from '@/lib/market.mjs';

// Coalesce concurrent visitors and throttle failed requests as well as successful ones.
const entries = new Map<string, { until: number; value: ReturnType<typeof normalizeMarket>; pending?: Promise<ReturnType<typeof normalizeMarket>> }>();
async function indicator(endpoint: { id: string; path: string; seconds: number }) {
  const cached = entries.get(endpoint.id);
  if (cached?.pending) return cached.pending;
  if (cached && cached.until > Date.now()) return cached.value;
  const entry = cached || { until: 0, value: null };
  const request = async () => {
    try {
      const response = await fetch(`https://datosuruguay.com/api/v1/${endpoint.path}`, {
        next: { revalidate: endpoint.seconds }, signal: AbortSignal.timeout(4000),
        headers: { Accept: 'application/json' }, redirect: 'error',
      });
      if (!response.ok) {
        const retry = Number(response.headers.get('retry-after'));
        entry.until = Date.now() + Math.max(60000, Number.isFinite(retry) ? Math.min(retry * 1000, 3600000) : 0);
        return null;
      }
      const value = normalizeMarket(endpoint.id, await response.json());
      entry.until = Date.now() + (value ? endpoint.seconds * 1000 : 60000);
      return value;
    } catch { entry.until = Date.now() + 60000; return null; }
  };
  entries.set(endpoint.id, entry);
  entry.pending = request();
  try { entry.value = await entry.pending; return entry.value; }
  finally { delete entry.pending; }
}
export async function marketSnapshot() {
  const settled = await Promise.allSettled(marketEndpoints.map(indicator));
  return settled.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []);
}
